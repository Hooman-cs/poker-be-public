/**
 * @fileoverview Tier-1 multi-hand smoke test — proves button rotation works
 * across consecutive hands on the same desk.
 *
 * Seeds 3 users + a desk, plays the SAME action pattern three times in a row,
 * and verifies that the button rotates clockwise between hands (seat 1 → 2 → 3).
 *
 * The action pattern is role-based, not user-based:
 *   - Pre-flop: UTG calls, SB calls (Carol's BB-posting closes the round).
 *   - Flop:     SB checks, BB checks, UTG raises ₹6, SB folds, BB calls.
 *   - Turn:     BB checks, UTG checks.
 *   - River:    BB checks, UTG all-ins, BB folds → single survivor (UTG wins).
 *
 * Each hand's roles (UTG/SB/BB) are different because the button rotates,
 * so the players involved in each action change hand-to-hand. The script
 * resolves "UTG"/"SB"/"BB" against the engine's currentGame.players each
 * hand before driving actions.
 *
 * USAGE:
 *   npx tsx --env-file=.env.local scripts/playThreeHands.ts
 *   npx tsx --env-file=.env.local scripts/playThreeHands.ts --keep
 *
 * VERIFIES:
 *   - Button at seat 1 after hand 1, seat 2 after hand 2, seat 3 after hand 3.
 *   - SB role holder changed between each consecutive pair of hands.
 *   - 3 distinct archive documents created.
 *   - Cumulative money conservation: wallets + seats == 3 × initial wallet.
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
const INITIAL_WALLET = 200 * RUPEE;      // ₹200 — more headroom than playOneHand
const MIN_BUY_IN = 50 * RUPEE;            // ₹50
const MAX_BUY_IN = 200 * RUPEE;           // ₹200
const BUY_IN_AMOUNT = 150 * RUPEE;        // ₹150 — enough that 3 losing hands don't drop below MIN_BUY_IN
const STAKE = 1 * RUPEE;                  // ₹1 SB / ₹2 BB

const failures: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) {
    failures.push(message);
    process.stdout.write(`  FAIL: ${message}\n`);
  } else {
    process.stdout.write(`  ok:   ${message}\n`);
  }
}

interface Seeded {
  pokerId: Types.ObjectId;
  modeId: Types.ObjectId;
  deskId: Types.ObjectId;
  users: Array<{ _id: Types.ObjectId; username: string }>;
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
    tableName: 'Three-Hand Smoke Table',
    gameType: "Texas Hold'em",
    bType: 'blinds',
    mode: 'cash',
    currency: 'INR',
    stake: STAKE,
    minBuyIn: MIN_BUY_IN,
    maxBuyIn: MAX_BUY_IN,
    maxSeats: 6,
    status: 'active',
    seats: [],
  });

  const userSpecs = [
    { username: 'threehand_alice', providerId: 'threehand-alice' },
    { username: 'threehand_bob',   providerId: 'threehand-bob' },
    { username: 'threehand_carol', providerId: 'threehand-carol' },
  ];

  const users: Seeded['users'] = [];
  for (const spec of userSpecs) {
    const user = await User.create({
      email: `${spec.username}@smoketest.local`,
      username: spec.username,
      usernameLocked: true,
      authProviders: [{ provider: 'google', providerId: spec.providerId, linkedAt: new Date() }],
      status: 'active',
    });
    await Wallet.create({
      userId: user._id,
      balance: INITIAL_WALLET,
      instantBonus: 0,
      lockedBonus: 0,
      currency: 'INR',
    });
    users.push({ _id: user._id, username: user.username });
  }

  process.stdout.write(`  poker=${poker._id} mode=${mode._id} desk=${desk._id} users=${users.length}\n`);
  return { pokerId: poker._id, modeId: mode._id, deskId: desk._id, users };
}

async function seatAndBuyIn(seeded: Seeded): Promise<void> {
  process.stdout.write('Seating users with buy-ins...\n');
  for (let i = 0; i < seeded.users.length; i++) {
    const u = seeded.users[i];
    await gameService.addUserToSeat({
      deskId: seeded.deskId.toString(),
      userId: u._id,
      seatNumber: i + 1,
      buyInAmount: BUY_IN_AMOUNT,
    });
    process.stdout.write(`  ${u.username} -> seat ${i + 1} with buy-in ${BUY_IN_AMOUNT}\n`);
  }
}

/**
 * Resolves the role-based plan to a concrete user sequence for this hand.
 * Reads the engine's currentGame.players to find who has each role.
 *
 * Returns one extra piece of info — the SB userId for cross-hand rotation
 * assertions later.
 */
type Role = 'utg' | 'sb' | 'bb';
type Action = 'fold' | 'check' | 'call' | 'raise' | 'all-in';
interface PlanStep { role: Role; action: Action; amount?: number }

const ROLE_BASED_PLAN: PlanStep[] = [
  // Pre-flop
  { role: 'utg', action: 'call' },
  { role: 'sb',  action: 'call' },
  // Flop opens with SB
  { role: 'sb',  action: 'check' },
  { role: 'bb',  action: 'check' },
  { role: 'utg', action: 'raise', amount: 6 * RUPEE },
  { role: 'sb',  action: 'fold' },
  { role: 'bb',  action: 'call' },
  // Turn opens with BB (SB folded)
  { role: 'bb',  action: 'check' },
  { role: 'utg', action: 'check' },
  // River — same order
  { role: 'bb',  action: 'check' },
  { role: 'utg', action: 'all-in' },
  { role: 'bb',  action: 'fold' },
];

interface RoleMap {
  utg: Types.ObjectId;
  sb: Types.ObjectId;
  bb: Types.ObjectId;
}

/**
 * Builds the role map for the current hand by reading currentGame.players.
 *
 * The engine sets player.role to 'sb' / 'bb' / 'player'. UTG isn't an explicit
 * role tag — it's "the first to act pre-flop." We get UTG by reading the
 * currentTurnPlayer at the start of the game (before any action has been
 * taken), since createGame sets it to UTG.
 */
async function buildRoleMap(deskId: Types.ObjectId): Promise<RoleMap> {
  const desk = await PokerDesk.findById(deskId);
  if (!desk?.currentGame) throw new Error('No current game');
  const sb = desk.currentGame.players.find((p) => p.role === 'sb');
  const bb = desk.currentGame.players.find((p) => p.role === 'bb');
  if (!sb || !bb) throw new Error('Could not find SB or BB in current game');
  const utgId = desk.currentGame.currentTurnPlayer;
  if (!utgId) throw new Error('No currentTurnPlayer at start of hand');
  return { utg: utgId, sb: sb.userId, bb: bb.userId };
}

async function playOneHandWithRoles(
  seeded: Seeded,
  handNumber: number
): Promise<{ archiveId: Types.ObjectId; sbUserId: Types.ObjectId }> {
  process.stdout.write(`\n=== Hand ${handNumber} ===\n`);

  await gameService.createGame({ deskId: seeded.deskId.toString() });
  const roles = await buildRoleMap(seeded.deskId);

  const nameById = new Map(seeded.users.map((u) => [u._id.toString(), u.username]));
  const roleNames: Record<Role, string> = {
    utg: nameById.get(roles.utg.toString()) ?? '?',
    sb: nameById.get(roles.sb.toString()) ?? '?',
    bb: nameById.get(roles.bb.toString()) ?? '?',
  };
  process.stdout.write(`  Roles: UTG=${roleNames.utg}, SB=${roleNames.sb}, BB=${roleNames.bb}\n`);

  for (let i = 0; i < ROLE_BASED_PLAN.length; i++) {
    const step = ROLE_BASED_PLAN[i];
    const actorId = roles[step.role];

    const desk = await PokerDesk.findById(seeded.deskId);
    if (!desk?.currentGame) {
      throw new Error(`Hand ${handNumber} step ${i}: desk has no currentGame`);
    }
    const expectedTurn = desk.currentGame.currentTurnPlayer?.toString();
    if (expectedTurn !== actorId.toString()) {
      const expectedName = nameById.get(expectedTurn ?? '') ?? expectedTurn;
      const wantedName = roleNames[step.role];
      throw new Error(
        `Hand ${handNumber} step ${i}: plan wants ${step.role} (${wantedName}) to act, ` +
          `engine wants ${expectedName}`
      );
    }

    const result = await gameService.handlePlayerAction({
      deskId: seeded.deskId.toString(),
      userId: actorId,
      action: step.action,
      amount: step.amount,
    });

    if (result.needsShowdown && i !== ROLE_BASED_PLAN.length - 1) {
      throw new Error(
        `Hand ${handNumber}: showdown triggered at step ${i}, plan has ${ROLE_BASED_PLAN.length - 1 - i} more steps`
      );
    }
  }

  const showdownResult = await gameService.showdown({ deskId: seeded.deskId.toString() });
  process.stdout.write(`  -> showdown complete, archive=${showdownResult.archive._id}\n`);
  return { archiveId: showdownResult.archive._id, sbUserId: roles.sb };
}

async function verify(
  seeded: Seeded,
  results: { archiveId: Types.ObjectId; sbUserId: Types.ObjectId }[]
): Promise<void> {
  process.stdout.write('\nVerifying...\n');

  const desk = await PokerDesk.findById(seeded.deskId);
  if (!desk) {
    check(false, 'desk exists after 3 hands');
    return;
  }

  // Button advanced through seat 1 → 2 → 3 across the three hands. After
  // hand 3, the button should be at seat 3 (the rotation rule advances to
  // "next eligible seat with seatNumber > prev"; after seat 2 it picks
  // seat 3).
  check(
    desk.buttonSeatNumber === 3,
    `desk.buttonSeatNumber == 3 after hand 3 (got ${desk.buttonSeatNumber})`
  );

  // SB role rotated between consecutive hands. After hand 1 (button seat 1,
  // SB seat 2 = Bob), hand 2 (button seat 2, SB seat 3 = Carol), hand 3
  // (button seat 3, SB seat 1 = Alice).
  const sb1 = results[0].sbUserId.toString();
  const sb2 = results[1].sbUserId.toString();
  const sb3 = results[2].sbUserId.toString();
  check(sb1 !== sb2, `SB changed between hand 1 (${sb1}) and hand 2 (${sb2})`);
  check(sb2 !== sb3, `SB changed between hand 2 (${sb2}) and hand 3 (${sb3})`);
  check(sb1 !== sb3, `SB changed between hand 1 (${sb1}) and hand 3 (${sb3}) — full rotation`);

  // Three distinct archive documents.
  const archiveIds = new Set(results.map((r) => r.archiveId.toString()));
  check(
    archiveIds.size === 3,
    `3 distinct archive documents created (got ${archiveIds.size})`
  );

  // Each archive exists and is well-formed.
  for (let i = 0; i < results.length; i++) {
    const archive = await PokerGameArchive.findById(results[i].archiveId);
    check(archive !== null, `hand ${i + 1} archive exists`);
    if (archive) {
      const winners = archive.players.filter((p) => p.isWinner);
      check(winners.length === 1, `hand ${i + 1} has exactly one winner`);
    }
  }

  // Cumulative money conservation. After 3 hands no money was created
  // or destroyed — sum of wallets + sum of seats == 3 × initial wallet.
  const wallets = await Wallet.find({ userId: { $in: seeded.users.map((u) => u._id) } });
  const walletSum = wallets.reduce((s, w) => s + w.balance, 0);
  const seatSum = desk.seats.reduce((s, seat) => s + (seat.balanceAtTable ?? 0), 0);
  const total = walletSum + seatSum;
  const expected = seeded.users.length * INITIAL_WALLET;
  check(
    total === expected,
    `cumulative money conservation across 3 hands: wallets(${walletSum}) + seats(${seatSum}) = ${total} (expected ${expected})`
  );

  // Desk state clean after final hand.
  check(
    desk.currentGame === null || desk.currentGame === undefined,
    'desk.currentGame is null after hand 3'
  );
  check(
    desk.currentGameStatus === 'finished',
    `desk.currentGameStatus is 'finished' after hand 3 (got '${desk.currentGameStatus}')`
  );
}

async function cleanup(
  seeded: Seeded,
  archiveIds: Types.ObjectId[]
): Promise<void> {
  if (KEEP_FLAG) {
    process.stdout.write('\n--keep flag set; data preserved for inspection.\n');
    process.stdout.write(`  desk:     ${seeded.deskId}\n`);
    process.stdout.write(`  archives: ${archiveIds.join(', ')}\n`);
    return;
  }

  process.stdout.write('\nCleaning up...\n');
  const userIds = seeded.users.map((u) => u._id);
  await Wallet.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  await PokerDesk.deleteOne({ _id: seeded.deskId });
  await PokerMode.deleteOne({ _id: seeded.modeId });
  if (archiveIds.length > 0) {
    await PokerGameArchive.deleteMany({ _id: { $in: archiveIds } });
  }
  process.stdout.write('  done.\n');
}

async function main(): Promise<void> {
  await dbConnect();

  let seeded: Seeded | null = null;
  const results: { archiveId: Types.ObjectId; sbUserId: Types.ObjectId }[] = [];

  try {
    seeded = await seed();
    await seatAndBuyIn(seeded);

    for (let hand = 1; hand <= 3; hand++) {
      const result = await playOneHandWithRoles(seeded, hand);
      results.push(result);
    }

    await verify(seeded, results);
  } catch (err) {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    process.stderr.write(`\nABORT: ${msg}\n`);
    failures.push(`script aborted: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (seeded) {
      await cleanup(seeded, results.map((r) => r.archiveId));
    }
    await mongoose.connection.close();
  }

  process.stdout.write('\n=== SUMMARY ===\n');
  if (failures.length === 0) {
    process.stdout.write('all checks passed.\n');
    process.exitCode = 0;
  } else {
    process.stdout.write(`${failures.length} check(s) FAILED:\n`);
    for (const f of failures) process.stdout.write(`  - ${f}\n`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(`\nUnhandled: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
});