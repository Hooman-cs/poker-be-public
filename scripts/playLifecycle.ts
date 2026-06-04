/**
 * @fileoverview Lifecycle smoke test — verifies the full desk lifecycle:
 * cold-start gate, warm play, mid-hand leave, multi-player counts,
 * dropping to warm-floor, force-closure when below minToContinue.
 *
 * Sequence (per phase 1 plan, see LOGS.md 2026-06-01):
 *   Hand 1: 4 players (= minToStart). Plays through. Desk warm.
 *   +2 join → 6 seated.
 *   Hand 2: 6 players. Plays through.
 *   Hand 3: 6 players. Mid-hand, player at seat 1 (UTG-of-the-moment) leaves → 5.
 *   Between hands: another leaves → 4.
 *   Hand 4: 4 players. Plays through.
 *   Between hands: another leaves → 3 (= minToContinue, warm floor).
 *   Hand 5: 3 players. Plays through.
 *   Between hands: another leaves → 2 (below minToContinue). force-close fires.
 *   Hand 6 attempt: createGame rejects (status='closed').
 *
 * USAGE:
 *   npx tsx --env-file=.env.local scripts/playLifecycle.ts
 *   npx tsx --env-file=.env.local scripts/playLifecycle.ts --keep
 *
 * Action plan per hand is "everyone folds to UTG" (the simplest plan that
 * scales across player counts 3-6). UTG raises, all others fold. UTG wins
 * by single-survivor short-circuit.
 */

import mongoose from 'mongoose';
import { Types } from 'mongoose';
import dbConnect from '@/config/dbConnect';
import Poker from '@/models/poker';
import PokerMode from '@/models/pokerMode';
import PokerDesk from '@/models/pokerDesk';
import User from '@/models/user';
import Wallet from '@/models/wallet';
import PokerGameArchive from '@/models/pokerGameArchive';
import * as gameService from '@/services/gameService';

const KEEP_FLAG = process.argv.includes('--keep');
const RUPEE = 100;
const INITIAL_WALLET = 500 * RUPEE;     // ₹500 — plenty of headroom
const MIN_BUY_IN = 50 * RUPEE;
const MAX_BUY_IN = 300 * RUPEE;
const BUY_IN_AMOUNT = 200 * RUPEE;
const STAKE = 1 * RUPEE;
const MIN_TO_START = 4;                  // admin-configured cold-start gate
// minToContinue defaults to 3 (schema floor)

const failures: string[] = [];
function check(condition: boolean, message: string): void {
  if (!condition) {
    failures.push(message);
    process.stdout.write(`  FAIL: ${message}\n`);
  } else {
    process.stdout.write(`  ok:   ${message}\n`);
  }
}

interface SeededUser { _id: Types.ObjectId; username: string; }
interface Seeded {
  pokerId: Types.ObjectId;
  modeId: Types.ObjectId;
  deskId: Types.ObjectId;
  users: SeededUser[]; // 6 total
}

async function seed(): Promise<Seeded> {
  process.stdout.write('Seeding...\n');

  const poker = await Poker.findOneAndUpdate(
    { gameType: "Texas Hold'em" },
    { $setOnInsert: { gameType: "Texas Hold'em", status: 'active' } },
    { upsert: true, new: true }
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
    tableName: 'Lifecycle Test Table',
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
      email: `lifecycle_${n}@smoketest.local`,
      username: `lifecycle_${n}`,
      usernameLocked: true,
      authProviders: [{ provider: 'google', providerId: `lifecycle-${n}`, linkedAt: new Date() }],
      status: 'active',
    });
    await Wallet.create({
      userId: u._id,
      balance: INITIAL_WALLET,
      instantBonus: 0,
      lockedBonus: 0,
      currency: 'INR',
    });
    users.push({ _id: u._id, username: u.username });
  }

  process.stdout.write(`  poker=${poker._id} mode=${mode._id} desk=${desk._id} users=6\n`);
  return { pokerId: poker._id, modeId: mode._id, deskId: desk._id, users };
}

async function sitUsers(deskId: Types.ObjectId, users: SeededUser[], startSeat: number): Promise<void> {
  for (let i = 0; i < users.length; i++) {
    await gameService.addUserToSeat({
      deskId: deskId.toString(),
      userId: users[i]._id,
      seatNumber: startSeat + i,
      buyInAmount: BUY_IN_AMOUNT,
    });
    process.stdout.write(`  ${users[i].username} -> seat ${startSeat + i}\n`);
  }
}

/**
 * Plays one hand using "everyone folds to UTG" plan. Reads currentTurnPlayer
 * to identify UTG, then drives every non-UTG player to fold pre-flop.
 *
 * Returns the archive id and the UTG user id (so cumulative assertions
 * can verify which player won each hand).
 */
async function playOneHand(
  deskId: Types.ObjectId,
  handLabel: string
): Promise<{ archiveId: Types.ObjectId; utgId: Types.ObjectId }> {
  process.stdout.write(`\n--- ${handLabel} ---\n`);
  await gameService.createGame({ deskId: deskId.toString() });

  let desk = await PokerDesk.findById(deskId);
  if (!desk?.currentGame) throw new Error(`${handLabel}: no currentGame after createGame`);

  const utgId = desk.currentGame.currentTurnPlayer;
  if (!utgId) throw new Error(`${handLabel}: no currentTurnPlayer`);

  // First action: UTG calls (pre-flop). Then all other active players fold.
  // After UTG calls, the turn advances through SB and BB (who haven't acted
  // explicitly in the round yet). They both fold. The round closes with
  // only UTG remaining → single-survivor showdown.
  //
  // Actually — simpler approach: UTG calls, every subsequent actor folds.
  // The engine auto-handles BB option closing.

  // UTG calls (matches BB's posted bet).
  await gameService.handlePlayerAction({
    deskId: deskId.toString(),
    userId: utgId,
    action: 'call',
  });

  // Now everyone else folds in turn order until single survivor.
  let safetyCounter = 0;
  while (safetyCounter++ < 20) {
    desk = await PokerDesk.findById(deskId);
    if (!desk?.currentGame) {
      // game finished
      break;
    }
    const nextTurn = desk.currentGame.currentTurnPlayer;
    if (!nextTurn) break;

    const result = await gameService.handlePlayerAction({
      deskId: deskId.toString(),
      userId: nextTurn,
      action: 'fold',
    });

    if (result.needsShowdown) break;
  }
  if (safetyCounter >= 20) throw new Error(`${handLabel}: action loop did not terminate`);

  const showdownResult = await gameService.showdown({ deskId: deskId.toString() });
  process.stdout.write(`  -> archive=${showdownResult.archive._id}, UTG=${utgId}\n`);
  return { archiveId: showdownResult.archive._id, utgId };
}

async function leaveSeat(deskId: Types.ObjectId, userId: Types.ObjectId, label: string): Promise<void> {
  await gameService.userLeavesSeat({ deskId: deskId.toString(), userId });
  process.stdout.write(`  ${label} left\n`);
}

async function main(): Promise<void> {
  await dbConnect();
  let seeded: Seeded | null = null;
  const archives: Types.ObjectId[] = [];

  try {
    seeded = await seed();

    // === Hand 1: 4 players at seats 1-4 ===
    process.stdout.write('\nSeating first 4 players (cold-start)...\n');
    await sitUsers(seeded.deskId, seeded.users.slice(0, 4), 1);

    // Confirm cold-start gate would have rejected 3 players (just check minToStart is what we expect)
    let desk = await PokerDesk.findById(seeded.deskId);
    check(desk!.minToStart === 4, `desk.minToStart === 4 (got ${desk!.minToStart})`);
    check(desk!.minToContinue === 3, `desk.minToContinue === 3 (got ${desk!.minToContinue})`);
    check(desk!.firstGameStartedAt === null || desk!.firstGameStartedAt === undefined, 'firstGameStartedAt null before hand 1');

    const h1 = await playOneHand(seeded.deskId, 'Hand 1 (4 players, cold→warm)');
    archives.push(h1.archiveId);

    desk = await PokerDesk.findById(seeded.deskId);
    check(desk!.firstGameStartedAt !== null && desk!.firstGameStartedAt !== undefined, 'firstGameStartedAt set after hand 1');
    check(desk!.status === 'active', `desk.status === 'active' after hand 1 (got '${desk!.status}')`);
    check(desk!.seats.length === 4, `4 seats after hand 1 (got ${desk!.seats.length})`);

    // === Between hands: 2 more sit ===
    process.stdout.write('\nSeating 2 more (warm desk)...\n');
    await sitUsers(seeded.deskId, seeded.users.slice(4, 6), 5);
    desk = await PokerDesk.findById(seeded.deskId);
    check(desk!.seats.length === 6, `6 seats after additions (got ${desk!.seats.length})`);

    // === Hand 2: 6 players ===
    const h2 = await playOneHand(seeded.deskId, 'Hand 2 (6 players)');
    archives.push(h2.archiveId);

    // === Hand 3: mid-hand leave ===
    process.stdout.write('\n--- Hand 3 (6 players, mid-hand leave) ---\n');
    await gameService.createGame({ deskId: seeded.deskId.toString() });
    desk = await PokerDesk.findById(seeded.deskId);
    const h3utg = desk!.currentGame!.currentTurnPlayer!;
    // UTG calls. Then before others act, find a non-UTG seated player and have them leave mid-hand.
    await gameService.handlePlayerAction({
      deskId: seeded.deskId.toString(),
      userId: h3utg,
      action: 'call',
    });
    // Now mid-hand: find a player still seated who is NOT UTG and NOT the current turn-player.
    desk = await PokerDesk.findById(seeded.deskId);
    const stillSeated = desk!.seats.map((s) => s.userId);
    const midLeaver = stillSeated.find((id) =>
      id.toString() !== h3utg.toString() &&
      id.toString() !== desk!.currentGame!.currentTurnPlayer!.toString()
    )!;
    const midLeaverName = seeded.users.find((u) => u._id.toString() === midLeaver.toString())!.username;
    process.stdout.write(`  mid-hand leave: ${midLeaverName}\n`);
    await leaveSeat(seeded.deskId, midLeaver, midLeaverName);

    // Now drive remaining folds until showdown.
    let loopGuard = 0;
    while (loopGuard++ < 20) {
      desk = await PokerDesk.findById(seeded.deskId);
      if (!desk?.currentGame) break;
      const t = desk.currentGame.currentTurnPlayer;
      if (!t) break;
      const r = await gameService.handlePlayerAction({
        deskId: seeded.deskId.toString(),
        userId: t,
        action: 'fold',
      });
      if (r.needsShowdown) break;
    }
    const h3showdown = await gameService.showdown({ deskId: seeded.deskId.toString() });
    archives.push(h3showdown.archive._id);

    desk = await PokerDesk.findById(seeded.deskId);
    check(desk!.seats.length === 5, `5 seats after hand 3 mid-leave (got ${desk!.seats.length})`);
    check(desk!.status === 'active', `desk still active after hand 3 (got '${desk!.status}')`);

    // === Between hands 3-4: one more leaves (down to 4) ===
    const remainingAfterH3 = desk!.seats.map((s) => s.userId);
    await leaveSeat(seeded.deskId, remainingAfterH3[0], seeded.users.find((u) => u._id.toString() === remainingAfterH3[0].toString())!.username);
    desk = await PokerDesk.findById(seeded.deskId);
    check(desk!.seats.length === 4, `4 seats before hand 4 (got ${desk!.seats.length})`);
    check(desk!.status === 'active', `desk still active with 4 seats (>= minToContinue)`);

    // === Hand 4: 4 players (warm-game, below minToStart but above minToContinue) ===
    const h4 = await playOneHand(seeded.deskId, 'Hand 4 (4 players, warm — below minToStart but above minToContinue)');
    archives.push(h4.archiveId);

    // === Between hands 4-5: one leaves (down to 3) ===
    desk = await PokerDesk.findById(seeded.deskId);
    const remAfterH4 = desk!.seats.map((s) => s.userId);
    await leaveSeat(seeded.deskId, remAfterH4[0], seeded.users.find((u) => u._id.toString() === remAfterH4[0].toString())!.username);
    desk = await PokerDesk.findById(seeded.deskId);
    check(desk!.seats.length === 3, `3 seats before hand 5 (got ${desk!.seats.length})`);
    check(desk!.status === 'active', `desk active at exactly minToContinue=3`);

    // === Hand 5: 3 players (warm floor) ===
    const h5 = await playOneHand(seeded.deskId, 'Hand 5 (3 players, at warm floor)');
    archives.push(h5.archiveId);

    // === Between hands 5-6: one leaves (down to 2 < minToContinue → force-close) ===
    process.stdout.write('\nLeave that triggers force-close...\n');
    desk = await PokerDesk.findById(seeded.deskId);
    const remAfterH5 = desk!.seats.map((s) => s.userId);
    await leaveSeat(seeded.deskId, remAfterH5[0], seeded.users.find((u) => u._id.toString() === remAfterH5[0].toString())!.username);

    desk = await PokerDesk.findById(seeded.deskId);
    check(desk!.status === 'closed', `desk.status === 'closed' after drop below minToContinue (got '${desk!.status}')`);
    check(desk!.seats.length === 0, `seats cleared after force-close (got ${desk!.seats.length})`);

    // === Hand 6 attempt: rejected because closed ===
    process.stdout.write('\nHand 6 attempt — should reject...\n');
    let rejected = false;
    try {
      await gameService.createGame({ deskId: seeded.deskId.toString() });
    } catch (err) {
      rejected = true;
      const m = err instanceof Error ? err.message : String(err);
      process.stdout.write(`  rejected: ${m}\n`);
    }
    check(rejected, 'createGame on closed desk threw');

    // === Money conservation ===
    process.stdout.write('\nMoney conservation...\n');
    const finalWallets = await Wallet.find({ userId: { $in: seeded.users.map((u) => u._id) } });
    const finalWalletSum = finalWallets.reduce((s, w) => s + w.balance, 0);
    desk = await PokerDesk.findById(seeded.deskId);
    const finalSeatSum = desk!.seats.reduce((s, seat) => s + (seat.balanceAtTable ?? 0), 0);
    const total = finalWalletSum + finalSeatSum;
    const expected = seeded.users.length * INITIAL_WALLET;
    check(
      total === expected,
      `total money preserved: wallets(${finalWalletSum}) + seats(${finalSeatSum}) = ${total} (expected ${expected})`
    );

    // === Archives ===
    check(archives.length === 5, `5 archives created across hands 1-5 (got ${archives.length})`);
  } catch (err) {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    process.stderr.write(`\nABORT: ${msg}\n`);
    failures.push(`script aborted: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (seeded) {
      if (KEEP_FLAG) {
        process.stdout.write(`\n--keep: desk=${seeded.deskId}\n`);
      } else {
        process.stdout.write('\nCleaning up...\n');
        const ids = seeded.users.map((u) => u._id);
        await Wallet.deleteMany({ userId: { $in: ids } });
        await User.deleteMany({ _id: { $in: ids } });
        await PokerDesk.deleteOne({ _id: seeded.deskId });
        await PokerMode.deleteOne({ _id: seeded.modeId });
        if (archives.length > 0) await PokerGameArchive.deleteMany({ _id: { $in: archives } });
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
  process.stderr.write(`\nUnhandled: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
});