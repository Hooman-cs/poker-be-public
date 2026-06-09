/**
 * @fileoverview Tier-2 end-to-end smoke test — exercises the full stack via
 * HTTP + Socket.io (no direct service imports). Must be run with `npm run dev`
 * already serving on ports 3000 (Next.js) and 3001 (Socket.io).
 *
 * Mirrors playLifecycle.ts phase structure exactly:
 *   Hand 1: 4 players (cold-start). Hand 2: 6 players. Hand 3: mid-hand leave.
 *   Hand 4: 4 players. Hand 5: 3 players (warm floor). Force-close. H6 reject.
 *
 * Additional checks: HTTP lobby endpoints, socket auth rejection, redacted
 * room broadcasts, targeted hole-card delivery.
 *
 * USAGE:
 *   npx tsx --env-file=.env.local scripts/tier2Smoke.ts
 *   npx tsx --env-file=.env.local scripts/tier2Smoke.ts --keep
 */

import { io, Socket } from 'socket.io-client';
import { signToken } from '@/utils/jwt';
import mongoose, { Types } from 'mongoose';
import dbConnect from '@/config/dbConnect';
import Poker from '@/models/poker';
import PokerMode from '@/models/pokerMode';
import PokerDesk from '@/models/pokerDesk';
import User from '@/models/user';
import Wallet from '@/models/wallet';
import PokerGameArchive from '@/models/pokerGameArchive';

const KEEP_FLAG = process.argv.includes('--keep');
const RUPEE = 100;
const INITIAL_WALLET = 500 * RUPEE;
const MIN_BUY_IN = 50 * RUPEE;
const MAX_BUY_IN = 300 * RUPEE;
const BUY_IN_AMOUNT = 200 * RUPEE;
const STAKE = 1 * RUPEE;
const MIN_TO_START = 4;
const HTTP_BASE = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3001';

const failures: string[] = [];
function check(condition: boolean, message: string): void {
  if (!condition) {
    failures.push(message);
    process.stdout.write(`  FAIL: ${message}\n`);
  } else {
    process.stdout.write(`  ok:   ${message}\n`);
  }
}

interface SeededUser { _id: Types.ObjectId; username: string; token: string; }
interface Seeded {
  pokerId: Types.ObjectId;
  modeId: Types.ObjectId;
  deskId: Types.ObjectId;
  users: SeededUser[];
}

function waitFor<T>(socket: Socket, event: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout waiting for '${event}' on socket ${socket.id}`)),
      timeoutMs,
    );
    socket.once(event, (data: T) => { clearTimeout(t); resolve(data); });
  });
}

function waitForHoleCards(socket: Socket, timeoutMs = 6000): Promise<{ holeCards: any[] }> {
  return new Promise((resolve, reject) => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const handler = (data: any) => {
      if (data && Array.isArray(data.holeCards)) {
        if (t !== null) clearTimeout(t);
        socket.off('game:start', handler);
        resolve(data as { holeCards: any[] });
      }
      // else: room broadcast ({ desk }) — keep listening
    };
    t = setTimeout(() => {
      socket.off('game:start', handler);
      reject(new Error(`timeout waiting for targeted hole cards on socket ${socket.id}`));
    }, timeoutMs);
    socket.on('game:start', handler);
  });
}

async function connectSocket(token: string): Promise<Socket> {
  const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', (err) => reject(err));
  });
  return socket;
}

async function seed(): Promise<Seeded> {
  process.stdout.write('Seeding...\n');

  const poker = await Poker.findOneAndUpdate(
    { gameType: "Texas Hold'em" },
    { $setOnInsert: { gameType: "Texas Hold'em", status: 'active' } },
    { upsert: true, new: true },
  );

  const mode = await PokerMode.create({
    pokerId: poker._id,
    gameType: "Texas Hold'em",
    bType: 'blinds',
    mode: 'cash',
    currency: 'INR',
    stake: STAKE,
    minBuyIn: MIN_BUY_IN,
    maxBuyIn: MAX_BUY_IN,
    status: 'active',
  });

  const desk = await PokerDesk.create({
    pokerModeId: mode._id,
    tableName: 'Tier2 Smoke Table',
    gameType: "Texas Hold'em",
    bType: 'blinds',
    mode: 'cash',
    currency: 'INR',
    stake: STAKE,
    minBuyIn: MIN_BUY_IN,
    maxBuyIn: MAX_BUY_IN,
    maxSeats: 6,
    minToStart: MIN_TO_START,
    minToContinue: 3,
    maxPlayerCount: 6,
    status: 'active',
    seats: [],
  });

  const names = ['alice', 'bob', 'carol', 'dave', 'eve', 'frank'];
  const users: SeededUser[] = [];
  for (const n of names) {
    const u = await User.create({
      email: `tier2_${n}@smoketest.local`,
      username: `tier2_${n}`,
      usernameLocked: true,
      authProviders: [{ provider: 'google', providerId: `tier2-${n}`, linkedAt: new Date() }],
      status: 'active',
    });
    await Wallet.create({
      userId: u._id,
      balance: INITIAL_WALLET,
      instantBonus: 0,
      lockedBonus: 0,
      currency: 'INR',
    });
    const token = signToken({ userId: u._id.toString(), role: 'user' });
    users.push({ _id: u._id, username: u.username, token });
  }

  process.stdout.write(`  poker=${poker._id} mode=${mode._id} desk=${desk._id} users=6\n`);
  return { pokerId: poker._id, modeId: mode._id, deskId: desk._id, users };
}

async function verifyHttp(seeded: Seeded): Promise<void> {
  process.stdout.write('\nVerifying HTTP endpoints...\n');
  const authHeader = `Bearer ${seeded.users[0].token}`;

  const gamesRes = await fetch(`${HTTP_BASE}/api/lobby/games`, {
    headers: { Authorization: authHeader },
  });
  check(gamesRes.status === 200, `GET /api/lobby/games → 200 (got ${gamesRes.status})`);
  const gamesBody = await gamesRes.json();
  check(
    Array.isArray(gamesBody.games) && gamesBody.games.length > 0,
    'GET /api/lobby/games → response.games is non-empty array',
  );

  const bestRes = await fetch(
    `${HTTP_BASE}/api/lobby/desks/best?modeId=${seeded.modeId.toString()}`,
    { headers: { Authorization: authHeader } },
  );
  check(bestRes.status === 200, `GET /api/lobby/desks/best → 200 (got ${bestRes.status})`);
  const bestBody = await bestRes.json();
  check(bestBody.desk !== null && bestBody.desk !== undefined, 'GET /api/lobby/desks/best → desk is not null');
}

async function verifySocketAuth(): Promise<void> {
  process.stdout.write('\nVerifying socket auth rejection...\n');
  await new Promise<void>((resolve) => {
    const bad = io(SOCKET_URL, { auth: { token: 'bad-token' }, transports: ['websocket'] });
    bad.once('connect_error', (err) => {
      check(
        err.message === 'INVALID_TOKEN',
        `bad-token → connect_error INVALID_TOKEN (got '${err.message}')`,
      );
      bad.disconnect();
      resolve();
    });
    bad.once('connect', () => {
      check(false, 'bad-token should not connect');
      bad.disconnect();
      resolve();
    });
  });
}

async function joinDesk(
  socket: Socket,
  deskId: string,
  seatNumber: number,
  buyInAmount: number,
  label: string,
): Promise<void> {
  socket.emit('join', { deskId, seatNumber, buyInAmount });
  await waitFor(socket, 'player:joined', 5000);
  process.stdout.write(`  ${label} -> seat ${seatNumber}\n`);
}

async function leaveViaSocket(
  leaverSocket: Socket,
  observerSocket: Socket,
  deskId: string,
  label: string,
): Promise<void> {
  leaverSocket.emit('leave', { deskId });
  await waitFor(observerSocket, 'player:left', 5000);
  process.stdout.write(`  ${label} left (via socket)\n`);
}

/**
 * Plays one hand using "UTG calls, all others fold" strategy via socket events.
 * Registers turn:start → showdown listeners first (synchronous), then awaits game:start.
 * Pass a pre-registered gameStartP when the auto-start fires during a between-hand leave.
 */
async function playHandViaSocket(
  sockets: Map<string, Socket>,
  deskId: string,
  handLabel: string,
  gameStartP?: Promise<{ desk: any }>,
  preHoleCardPs?: Map<string, Promise<{ holeCards: any[] }>>,
): Promise<void> {
  process.stdout.write(`\n--- ${handLabel} ---\n`);

  const sockEntries = [...sockets.entries()];
  const [, firstSocket] = sockEntries[0];

  // Pre-register hole-card promises synchronously at the top — before any await.
  const holeCardPs = preHoleCardPs ?? (() => {
    const m = new Map<string, Promise<{ holeCards: any[] }>>();
    for (const [userId, socket] of sockets) {
      m.set(userId, waitForHoleCards(socket, 6000));
    }
    return m;
  })();

  let utgId: string | null = null;
  const actionPromises: Promise<void>[] = [];

  for (const [userId, socket] of sockets) {
    const p = new Promise<void>((resolve) => {
      const onTurnStart = () => {
        const action = userId === utgId ? 'call' : 'fold';
        socket.emit('action', { deskId, action });
      };
      socket.on('turn:start', onTurnStart);
      socket.once('game:showdown', () => {
        socket.off('turn:start', onTurnStart);
        resolve();
      });
    });
    actionPromises.push(p);
  }

  // Use pre-registered promise or create a new one now.
  const gsP = gameStartP ?? waitFor<{ desk: any }>(firstSocket, 'game:start', 8000);
  const gameStartData = await gsP;
  utgId = gameStartData.desk?.currentGame?.currentTurnPlayer ?? null;

  // Verify room broadcast is redacted (all holeCards empty).
  const players: any[] = gameStartData.desk?.currentGame?.players ?? [];
  check(
    players.every((p: any) => Array.isArray(p.holeCards) && p.holeCards.length === 0),
    `${handLabel}: room broadcast has redacted holeCards`,
  );

  // Verify targeted hole-card delivery using pre-registered promises.
  for (const [userId] of sockets) {
    try {
      const targeted = await holeCardPs.get(userId)!;
      check(
        Array.isArray(targeted.holeCards) && targeted.holeCards.length === 2,
        `${handLabel}: ${userId.slice(-4)} received 2 targeted hole cards`,
      );
    } catch {
      check(false, `${handLabel}: ${userId.slice(-4)} did NOT receive targeted hole cards (timeout)`);
    }
  }

  await Promise.all(actionPromises);
  process.stdout.write(`  -> showdown complete\n`);
}

async function main(): Promise<void> {
  await dbConnect();
  let seeded: Seeded | null = null;
  const allSockets: Socket[] = [];

  try {
    seeded = await seed();
    await verifyHttp(seeded);
    await verifySocketAuth();

    const deskId = seeded.deskId.toString();

    // Connect all 6 sockets upfront.
    const sockets: Socket[] = [];
    for (const u of seeded.users) {
      const s = await connectSocket(u.token);
      sockets.push(s);
      allSockets.push(s);
    }

    // Active participants map: userId string → Socket.
    // Maintained throughout — leavers are deleted so they're excluded from future hands.
    const activeSockets = new Map<string, Socket>();

    // HAND 1: 4 players (cold-start gate = minToStart = 4)
    process.stdout.write('\nSeating first 4 players (cold-start)...\n');
    for (let i = 0; i < 4; i++) {
      await joinDesk(sockets[i], deskId, i + 1, BUY_IN_AMOUNT, seeded.users[i].username);
      activeSockets.set(seeded.users[i]._id.toString(), sockets[i]);
    }

    let desk = await PokerDesk.findById(seeded.deskId);
    check(desk!.minToStart === MIN_TO_START, `desk.minToStart === ${MIN_TO_START} (got ${desk!.minToStart})`);
    check(desk!.minToContinue === 3, `desk.minToContinue === 3 (got ${desk!.minToContinue})`);
    check(
      desk!.firstGameStartedAt == null,
      'firstGameStartedAt null before hand 1',
    );

    await playHandViaSocket(activeSockets, deskId, 'Hand 1 (4 players, cold→warm)');

    desk = await PokerDesk.findById(seeded.deskId);
    check(desk!.firstGameStartedAt != null, 'firstGameStartedAt set after hand 1');
    check(desk!.status === 'active', `desk.status === 'active' after hand 1 (got '${desk!.status}')`);
    check(desk!.seats.length === 4, `4 seats after hand 1 (got ${desk!.seats.length})`);

    // HAND 2: join 2 more (warm desk, threshold = minToContinue = 3, already met → auto-start resets on each join)
    process.stdout.write('\nSeating 2 more (warm desk)...\n');
    for (let i = 4; i < 6; i++) {
      await joinDesk(sockets[i], deskId, i + 1, BUY_IN_AMOUNT, seeded.users[i].username);
      activeSockets.set(seeded.users[i]._id.toString(), sockets[i]);
    }
    desk = await PokerDesk.findById(seeded.deskId);
    check(desk!.seats.length === 6, `6 seats after additions (got ${desk!.seats.length})`);

    await playHandViaSocket(activeSockets, deskId, 'Hand 2 (6 players)');

    // HAND 3: 6 players, mid-hand leave — handled manually to control leaver selection.
    // Auto-start from Hand 2 showdown fires after 3 s → game:start arrives automatically.
    process.stdout.write('\n--- Hand 3 (6 players, mid-hand leave) ---\n');
    {
      const sockArr = [...activeSockets.entries()];
      const [, firstSock] = sockArr[0];

      // Pre-register hole-card promises synchronously — before any await.
      const h3HoleCardPs = new Map<string, Promise<{ holeCards: any[] }>>();
      for (const [userId, socket] of activeSockets) {
        h3HoleCardPs.set(userId, waitForHoleCards(socket, 6000));
      }

      let h3UtgId: string | null = null;

      // Register turn:start/showdown listeners before awaiting game:start.
      // game:showdown listener uses Promise.race across all sockets because the mid-hand
      // leaver's socket leaves the room and won't receive the room broadcast.
      const onTurnHandlers = new Map<string, () => void>();
      for (const [userId, socket] of activeSockets) {
        const onTurn = () => {
          const action = userId === h3UtgId ? 'call' : 'fold';
          socket.emit('action', { deskId, action });
        };
        socket.on('turn:start', onTurn);
        onTurnHandlers.set(userId, onTurn);
      }

      // game:showdown resolves when ANY remaining socket receives it (leaver won't).
      const h3Done = new Promise<void>((resolve) => {
        const cleanup: Array<() => void> = [];
        for (const [userId, socket] of activeSockets) {
          const onShowdown = () => {
            for (const fn of cleanup) fn();
            // Clean up turn handlers too.
            for (const [uid, sock] of activeSockets) {
              const h = onTurnHandlers.get(uid);
              if (h) sock.off('turn:start', h);
            }
            resolve();
          };
          socket.once('game:showdown', onShowdown);
          cleanup.push(() => socket.off('game:showdown', onShowdown));
        }
      });

      const h3StartData = await waitFor<{ desk: any }>(firstSock, 'game:start', 8000);
      h3UtgId = h3StartData.desk?.currentGame?.currentTurnPlayer ?? null;

      const h3Players: any[] = h3StartData.desk?.currentGame?.players ?? [];
      check(
        h3Players.every((p: any) => Array.isArray(p.holeCards) && p.holeCards.length === 0),
        'Hand 3: room broadcast has redacted holeCards',
      );

      for (const [userId] of activeSockets) {
        try {
          const targeted = await h3HoleCardPs.get(userId)!;
          check(
            Array.isArray(targeted.holeCards) && targeted.holeCards.length === 2,
            `Hand 3: ${userId.slice(-4)} received 2 targeted hole cards`,
          );
        } catch {
          check(false, `Hand 3: ${userId.slice(-4)} did NOT receive targeted hole cards (timeout)`);
        }
      }

      // Pick leaver: last socket whose userId is not UTG.
      const leaverEntry = [...activeSockets.entries()].reverse()
        .find(([uid]) => uid !== h3UtgId);
      if (!leaverEntry) throw new Error('Hand 3: could not find a non-UTG leaver');
      const [leaverUid, leaverSock] = leaverEntry;
      const leaverUser = seeded!.users.find((u) => u._id.toString() === leaverUid)!;

      process.stdout.write(`  mid-hand leave: ${leaverUser.username}\n`);
      // Fire leave; wait for player:left on any remaining socket.
      leaverSock.emit('leave', { deskId });
      // player:left is a room broadcast — leaver has left the room by the time it fires,
      // so we wait on firstSock (which stays in the room).
      await waitFor(firstSock, 'player:left', 5000);
      process.stdout.write(`  ${leaverUser.username} left (via socket)\n`);
      activeSockets.delete(leaverUid);

      await h3Done;
      process.stdout.write('  -> showdown complete\n');
    }

    desk = await PokerDesk.findById(seeded.deskId);
    check(desk!.seats.length === 5, `5 seats after hand 3 mid-leave (got ${desk!.seats.length})`);
    check(desk!.status === 'active', `desk still active after hand 3 (got '${desk!.status}')`);

    // Between H3–H4: one more leaves (→ 4 seated).
    // Pre-register H4 game:start BEFORE emitting leave — auto-start timer is already running.
    {
      const actArr = [...activeSockets.entries()];
      const [, firstActiveSock] = actArr[0]; // will stay after leave
      const [leaverUid, leaverSock] = actArr[actArr.length - 1];

      const h4StartP = waitFor<{ desk: any }>(firstActiveSock, 'game:start', 12000);
      const h4HoleCardPs = new Map<string, Promise<{ holeCards: any[] }>>();
      for (const [uid, sock] of activeSockets) {
        if (uid !== leaverUid) h4HoleCardPs.set(uid, waitForHoleCards(sock, 10000));
      }

      const lu = seeded!.users.find((u) => u._id.toString() === leaverUid)!;
      await leaveViaSocket(leaverSock, actArr[0][1], deskId, lu.username);
      activeSockets.delete(leaverUid);

      desk = await PokerDesk.findById(seeded.deskId);
      check(desk!.seats.length === 4, `4 seats before hand 4 (got ${desk!.seats.length})`);
      check(desk!.status === 'active', 'desk still active with 4 seats (>= minToContinue)');

      // HAND 4
      await playHandViaSocket(
        activeSockets,
        deskId,
        'Hand 4 (4 players, warm — below minToStart but above minToContinue)',
        h4StartP,
        h4HoleCardPs,
      );
    }

    // Between H4–H5: one more leaves (→ 3 seated, warm floor).
    {
      const actArr = [...activeSockets.entries()];
      const [, firstActiveSock] = actArr[0];
      const [leaverUid, leaverSock] = actArr[actArr.length - 1];

      const h5StartP = waitFor<{ desk: any }>(firstActiveSock, 'game:start', 12000);
      const h5HoleCardPs = new Map<string, Promise<{ holeCards: any[] }>>();
      for (const [uid, sock] of activeSockets) {
        if (uid !== leaverUid) h5HoleCardPs.set(uid, waitForHoleCards(sock, 10000));
      }

      const lu = seeded!.users.find((u) => u._id.toString() === leaverUid)!;
      await leaveViaSocket(leaverSock, actArr[0][1], deskId, lu.username);
      activeSockets.delete(leaverUid);

      desk = await PokerDesk.findById(seeded.deskId);
      check(desk!.seats.length === 3, `3 seats before hand 5 (got ${desk!.seats.length})`);
      check(desk!.status === 'active', 'desk active at exactly minToContinue=3');

      // HAND 5
      await playHandViaSocket(
        activeSockets,
        deskId,
        'Hand 5 (3 players, at warm floor)',
        h5StartP,
        h5HoleCardPs,
      );
    }

    // Between H5–H6: one leaves → force-close (2 seats < minToContinue).
    process.stdout.write('\nLeave that triggers force-close...\n');
    {
      const actArr = [...activeSockets.entries()];
      const [leaverUid, leaverSock] = actArr[actArr.length - 1];
      const [, observerSock] = actArr[actArr.length - 2]; // receives desk:closed
      const lu = seeded!.users.find((u) => u._id.toString() === leaverUid)!;

      leaverSock.emit('leave', { deskId });
      // desk:closed is emitted to remaining room members (not the leaver who already left).
      await waitFor(observerSock, 'desk:closed', 5000);
      process.stdout.write(`  ${lu.username} left — desk:closed received\n`);
      activeSockets.delete(leaverUid);
    }

    desk = await PokerDesk.findById(seeded.deskId);
    check(
      desk!.status === 'closed',
      `desk.status === 'closed' after drop below minToContinue (got '${desk!.status}')`,
    );
    check(desk!.seats.length === 0, `seats cleared after force-close (got ${desk!.seats.length})`);

    // Hand 6 attempt: join on closed desk → 'error' event.
    process.stdout.write('\nHand 6 attempt — should reject...\n');
    {
      const anySock = sockets[0];
      anySock.emit('join', { deskId, seatNumber: 1, buyInAmount: BUY_IN_AMOUNT });
      try {
        const errData = await waitFor<{ code: string; message: string }>(anySock, 'error', 5000);
        process.stdout.write(`  rejected: ${errData.message}\n`);
        check(true, 'join on closed desk returned error event');
      } catch {
        check(false, 'join on closed desk did NOT return error event (timeout)');
      }
    }

    // Money conservation.
    process.stdout.write('\nMoney conservation...\n');
    const finalWallets = await Wallet.find({ userId: { $in: seeded!.users.map((u) => u._id) } });
    const finalWalletSum = finalWallets.reduce((s, w) => s + w.balance, 0);
    const finalDesk = await PokerDesk.findById(seeded!.deskId);
    const finalSeatSum = finalDesk!.seats.reduce((s, seat) => s + (seat.balanceAtTable ?? 0), 0);
    const total = finalWalletSum + finalSeatSum;
    const expected = seeded!.users.length * INITIAL_WALLET;
    check(
      total === expected,
      `total money preserved: wallets(${finalWalletSum}) + seats(${finalSeatSum}) = ${total} (expected ${expected})`,
    );

    // Archive checks.
    const archives = await PokerGameArchive.find({
      'players.userId': { $in: seeded!.users.map((u) => u._id) },
    });
    check(archives.length === 5, `5 archives created across hands 1-5 (got ${archives.length})`);
    const allHaveUsernames = archives.every(
      (a) => (a.players as any[]).every((p: any) => typeof p.username === 'string' && p.username.length > 0),
    );
    check(allHaveUsernames, 'all archived players have non-empty username');
  } catch (err) {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    process.stderr.write(`\nABORT: ${msg}\n`);
    failures.push(`script aborted: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    for (const s of allSockets) {
      if (s.connected) s.disconnect();
    }

    if (seeded) {
      if (KEEP_FLAG) {
        process.stdout.write(`\n--keep: desk=${seeded.deskId}\n`);
      } else {
        process.stdout.write('\nCleaning up...\n');
        const ids = seeded.users.map((u) => u._id);
        await PokerGameArchive.deleteMany({ 'players.userId': { $in: ids } });
        await Wallet.deleteMany({ userId: { $in: ids } });
        await User.deleteMany({ _id: { $in: ids } });
        await PokerDesk.deleteOne({ _id: seeded.deskId });
        await PokerMode.deleteOne({ _id: seeded.modeId });
      }
    }

    await mongoose.connection.close();
  }

  process.stdout.write('\n=== SUMMARY ===\n');
  if (failures.length === 0) {
    process.stdout.write('all checks passed.\n');
    process.exitCode = 0;
  } else {
    process.stdout.write(`${failures.length} FAILED:\n`);
    for (const f of failures) process.stdout.write(`  - ${f}\n`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(
    `\nUnhandled: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
});
