/**
 * @fileoverview Tier-1 smoke test for the frozen core (engine + service).
 *
 * Seeds a complete game environment (Poker + PokerMode + PokerDesk + 3 users
 * with wallets), drives a deterministic 3-player Texas Hold'em hand end-to-end
 * through gameService, then verifies the result.
 *
 * The script is the proof that Phase 0's frozen core actually works end-to-end
 * before Phase 3 layers HTTP routes and Phase 5 layers sockets on top of it.
 * If this fails, fix the engine/service NOW — not after building 5 more phases
 * of code on a broken foundation.
 *
 * USAGE:
 *
 *   Default (clean up after):
 *     npx tsx --env-file=.env.local scripts/playOneHand.ts
 *
 *   Keep data for inspection in mongosh after:
 *     npx tsx --env-file=.env.local scripts/playOneHand.ts --keep
 *
 * ACTION SEQUENCE (deterministic, single-survivor outcome):
 *   Pre-flop: SB and BB are auto-posted. UTG (Carol) calls. SB (Alice) calls.
 *             BB (Bob) checks. -> flop
 *   Flop:     Alice checks. Bob checks. Carol raises ₹6. Alice folds. Bob calls.
 *             -> turn
 *   Turn:     Bob checks. Carol checks. -> river
 *   River:    Bob checks. Carol goes all-in. Bob folds.
 *             -> single survivor (Carol) -> showdown
 *
 *   Carol wins everything; no hand evaluation needed (single-survivor short-circuit).
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
const RUPEE = 100; // paise per rupee (minor units conversion factor)
const INITIAL_WALLET = 100 * RUPEE; // ₹100 per player
const MIN_BUY_IN = 50 * RUPEE; // ₹50 — desk's range floor
const MAX_BUY_IN = 100 * RUPEE; // ₹100 — desk's range ceiling (strictly > min per model's pre-save validator)
const BUY_IN_AMOUNT = 50 * RUPEE; // ₹50 — what each player actually buys in for (must be in [MIN_BUY_IN, MAX_BUY_IN])
const STAKE = 1 * RUPEE; // ₹1 small blind (big blind = stake * 2 = ₹2 by engine convention)

// Track failures so we report all of them, not just the first.
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

  // Poker — game type + status only. gameType is unique-indexed, so reuse
  // any existing doc with the same gameType (typical when a prior --keep
  // run left data behind). Upsert keeps the script idempotent on the Poker row.
  const poker = await Poker.findOneAndUpdate(
    { gameType: "Texas Hold'em" },
    { $setOnInsert: { gameType: "Texas Hold'em", status: 'active' } },
    { upsert: true, new: true }
  );

  // PokerMode — template. mode='cash', currency, stake (SB; BB=2*stake), buy-in range.
  // gameType is required and duplicates the parent Poker's value (denormalization
  // pattern, same as PokerDesk). bType is auto-set by a pre-save hook from
  // gameType BUT validation runs before pre-save hooks, so we must set bType
  // explicitly here too.
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

  // PokerDesk — denormalized copies of mode/currency/stake/buy-in range live here.
  // tableName, gameType, bType are all required at this layer (desk does NOT auto-set
  // bType from gameType — that hook is on PokerMode only). minPlayerCount/maxPlayerCount
  // have schema defaults (2 and 6).
  const desk = await PokerDesk.create({
    pokerModeId: mode._id,
    tableName: 'Smoke Test Table',
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
    { username: 'smoketest_alice', providerId: 'smoketest-alice' },
    { username: 'smoketest_bob',   providerId: 'smoketest-bob' },
    { username: 'smoketest_carol', providerId: 'smoketest-carol' },
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
  // addUserToSeat takes seatNumber + buyInAmount in the SAME call. Seating
  // and buying in are not separate operations in this service.
  process.stdout.write('Seating users with buy-ins...\n');
  for (let i = 0; i < seeded.users.length; i++) {
    const u = seeded.users[i];
    await gameService.addUserToSeat({
      deskId: seeded.deskId.toString(),
      userId: u._id,
      seatNumber: i + 1, // 1-indexed; explicit so we know the seat order
      buyInAmount: BUY_IN_AMOUNT,
    });
    process.stdout.write(`  ${u.username} -> seat ${i + 1} with buy-in ${BUY_IN_AMOUNT}\n`);
  }
}

/**
 * Plays the scripted action sequence. After each action, reads the desk
 * state to figure out whose turn the engine says it is — if our script
 * disagrees with the engine, that's surfaced immediately with a clear error.
 */
async function playHand(seeded: Seeded): Promise<{ archiveId: Types.ObjectId }> {
  process.stdout.write('Creating game...\n');
  await gameService.createGame({ deskId: seeded.deskId.toString() });

  type Action = 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  // With buttonSeatNumber initialized to seat 1 (Alice = first seated):
  //   button = Alice(seat 1), SB = Bob(seat 2), BB = Carol(seat 3), UTG = Alice (wraps).
  // Pre-flop opens with Alice (UTG). Post-flop, the engine's getFirstActivePlayer
  // returns the first active seat clockwise of the button — that's Bob (seat 2 = SB).
  const plan: Array<{ who: string; action: Action; amount?: number }> = [
    // PRE-FLOP — Alice (UTG) calls, Bob (SB) calls. Carol's BB-posting counts
    // as her action; round closes.
    { who: 'smoketest_alice', action: 'call' },
    { who: 'smoketest_bob',   action: 'call' },
    // FLOP — opens with Bob (SB). Bob checks, Carol checks, Alice raises 6,
    // Bob folds, Carol calls.
    { who: 'smoketest_bob',   action: 'check' },
    { who: 'smoketest_carol', action: 'check' },
    { who: 'smoketest_alice', action: 'raise', amount: 6 * RUPEE },
    { who: 'smoketest_bob',   action: 'fold' },
    { who: 'smoketest_carol', action: 'call' },
    // TURN — opens with Carol (first active clockwise of button after Bob folded).
    // Carol checks, Alice checks.
    { who: 'smoketest_carol', action: 'check' },
    { who: 'smoketest_alice', action: 'check' },
    // RIVER — opens with Carol. Carol checks, Alice all-in, Carol folds → single survivor (Alice).
    { who: 'smoketest_carol', action: 'check' },
    { who: 'smoketest_alice', action: 'all-in' },
    { who: 'smoketest_carol', action: 'fold' },
  ];

  const byName = new Map(seeded.users.map((u) => [u.username, u]));

  let needsShowdown = false;
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const actor = byName.get(step.who);
    if (!actor) throw new Error(`plan refers to unknown user: ${step.who}`);

    const desk = await PokerDesk.findById(seeded.deskId);
    if (!desk?.currentGame) {
      throw new Error(`Step ${i}: desk has no currentGame (expected ${step.who} to ${step.action})`);
    }
    const expectedTurn = desk.currentGame.currentTurnPlayer?.toString();
    if (expectedTurn !== actor._id.toString()) {
      throw new Error(
        `Step ${i}: plan expected ${step.who} (${actor._id}) to act, but engine says current turn is ${expectedTurn}`
      );
    }

    process.stdout.write(`  step ${String(i).padStart(2)}: ${step.who} ${step.action}${step.amount ? ' ' + step.amount : ''}\n`);
    const result = await gameService.handlePlayerAction({
      deskId: seeded.deskId.toString(),
      userId: actor._id,
      action: step.action,
      amount: step.amount,
    });

    if (result.needsShowdown) {
      needsShowdown = true;
      if (i !== plan.length - 1) {
        throw new Error(
          `Showdown triggered at step ${i} but plan has ${plan.length - 1 - i} more steps. Plan is wrong.`
        );
      }
    }
  }

  if (!needsShowdown) {
    throw new Error('Plan completed without triggering showdown — something is off with the sequence.');
  }

  process.stdout.write('Calling showdown...\n');
  const showdownResult = await gameService.showdown({ deskId: seeded.deskId.toString() });
  return { archiveId: showdownResult.archive._id };
}

async function verify(seeded: Seeded, archiveId: Types.ObjectId): Promise<void> {
  process.stdout.write('Verifying...\n');

  const archive = await PokerGameArchive.findById(archiveId);
  check(archive !== null, 'archive document exists');
  if (!archive) return;

  check(archive.players.length === 3, `archive has 3 players (got ${archive.players.length})`);
  check(
    archive.players.every((p) => typeof p.username === 'string' && p.username.length > 0),
    'every archived player has a non-empty username (the fix from Phase 0)'
  );

  // In the new plan: Alice (UTG) raises on the flop, Carol calls, then on
  // river Alice all-ins and Carol folds → Alice is single survivor.
  const winners = archive.players.filter((p) => p.isWinner);
  check(winners.length === 1, `exactly one winner in archive (got ${winners.length})`);
  if (winners.length === 1) {
    check(
      winners[0].username === 'smoketest_alice',
      `winner is Alice (got ${winners[0].username})`
    );
  }

  // Money conservation. Each player started with INITIAL_WALLET. After the
  // hand, money sits in two places: wallets (untouched by showdown; only
  // changes on leave-seat) and seat balances at the table (where winnings
  // land). Sum must equal 3 * INITIAL_WALLET.
  const wallets = await Wallet.find({ userId: { $in: seeded.users.map((u) => u._id) } });
  const desk = await PokerDesk.findById(seeded.deskId);
  if (!desk) {
    check(false, 'desk still exists after showdown');
    return;
  }
  const walletSum = wallets.reduce((s, w) => s + w.balance, 0);
  const seatSum = desk.seats.reduce((s, seat) => s + (seat.balanceAtTable ?? 0), 0);
  const total = walletSum + seatSum;
  const expectedTotal = seeded.users.length * INITIAL_WALLET;
  check(
    total === expectedTotal,
    `money conservation: wallets(${walletSum}) + seats(${seatSum}) = ${total} (expected ${expectedTotal})`
  );

  const archivedPotSum = archive.pots.reduce((s, p) => s + p.totalAmount, 0);
  check(
    archive.totalPot === archivedPotSum,
    `archive totalPot (${archive.totalPot}) equals sum of pots (${archivedPotSum})`
  );

  check(desk.currentGame === null || desk.currentGame === undefined, 'desk.currentGame is null after showdown');
  check(desk.currentGameStatus === 'finished', `desk.currentGameStatus is 'finished' (got '${desk.currentGameStatus}')`);
}

async function cleanup(seeded: Seeded, archiveId: Types.ObjectId | null): Promise<void> {
  if (KEEP_FLAG) {
    process.stdout.write('\n--keep flag set; leaving seeded data in DB for inspection.\n');
    process.stdout.write(`  desk:    ${seeded.deskId}\n`);
    process.stdout.write(`  mode:    ${seeded.modeId}\n`);
    process.stdout.write(`  poker:   ${seeded.pokerId}\n`);
    process.stdout.write(`  archive: ${archiveId ?? '(none)'}\n`);
    process.stdout.write(`  users:   ${seeded.users.map((u) => u._id).join(', ')}\n`);
    return;
  }

  process.stdout.write('\nCleaning up...\n');
  const userIds = seeded.users.map((u) => u._id);
  await Wallet.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  await PokerDesk.deleteOne({ _id: seeded.deskId });
  await PokerMode.deleteOne({ _id: seeded.modeId });
  // NOTE: Poker doc is left in place — it's upserted by gameType on each run,
  // so deleting it would just force the next run to recreate it.
  if (archiveId) await PokerGameArchive.deleteOne({ _id: archiveId });
  process.stdout.write('  done.\n');
}

async function main(): Promise<void> {
  await dbConnect();

  let seeded: Seeded | null = null;
  let archiveId: Types.ObjectId | null = null;

  try {
    seeded = await seed();
    await seatAndBuyIn(seeded);
    const { archiveId: aId } = await playHand(seeded);
    archiveId = aId;
    await verify(seeded, archiveId);
  } catch (err) {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    process.stderr.write(`\nABORT: ${msg}\n`);
    failures.push(`script aborted: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (seeded) await cleanup(seeded, archiveId);
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