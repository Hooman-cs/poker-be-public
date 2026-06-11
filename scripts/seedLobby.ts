/**
 * @fileoverview Seed script — creates one Poker + two PokerModes + two PokerDesks
 * (one per mode) so GET /api/lobby/games returns real data.
 *
 * Idempotent: if a Poker with description "Lobby Seed — Texas Hold'em" already
 * exists, the script prints its IDs and exits without writing anything.
 *
 * Handles the pre-existing Poker case: smoke tests create a Poker with
 * gameType "Texas Hold'em" (unique-indexed). If that doc exists without our
 * description, we adopt it (update the description) and attach our modes/desks.
 *
 * NOTE: Neither Poker nor PokerMode has a 'name' field in the schema.
 * Poker uses 'description' as a human label; PokerMode is identified by stake.
 *
 * USAGE:
 *   npx tsx --env-file=.env.local scripts/seedLobby.ts
 */

import mongoose from 'mongoose';
import dbConnect from '@/config/dbConnect';
import Poker from '@/models/poker';
import PokerMode from '@/models/pokerMode';
import PokerDesk from '@/models/pokerDesk';

const SEED_DESCRIPTION = "Lobby Seed — Texas Hold'em";

async function main(): Promise<void> {
  process.stdout.write('=> Creating new database connection\n');
  await dbConnect();

  try {
    // Idempotency check — keyed on description so smoke-test artifacts don't
    // trigger a false-positive exit.
    const alreadySeeded = await Poker.findOne({ description: SEED_DESCRIPTION }).lean();
    if (alreadySeeded) {
      process.stdout.write('Lobby seed already exists — printing IDs and exiting.\n\n');
      process.stdout.write(`  Poker: ${alreadySeeded._id}\n`);

      const modes = await PokerMode.find({ pokerId: alreadySeeded._id }).lean();
      for (const m of modes) {
        process.stdout.write(`  PokerMode (mode=${m.mode} stake=${m.stake}): ${m._id}\n`);
        const desks = await PokerDesk.find({ pokerModeId: m._id }).lean();
        for (const d of desks) {
          const tag = d.isPractice ? 'Practice Desk' : `PokerDesk '${d.tableName}'`;
          process.stdout.write(`    ${tag}: ${d._id}\n`);
        }
      }
      return;
    }

    process.stdout.write('Seeding lobby data...\n');

    // Upsert the Poker so we don't collide with the unique gameType index if a
    // smoke test left a row behind. We adopt the existing row and set description.
    const poker = await Poker.findOneAndUpdate(
      { gameType: "Texas Hold'em" },
      { $set: { status: 'active', description: SEED_DESCRIPTION } },
      { upsert: true, new: true }
    );
    process.stdout.write(`  Poker: ${poker._id}\n`);

    // PokerMode A — Low Stakes (₹100/₹200 blinds).
    // bType must be passed explicitly: validation runs before the pre-save hook
    // that auto-sets it from gameType (see CLAUDE.md discipline gotchas).
    const modeA = await PokerMode.create({
      pokerId: poker._id,
      gameType: "Texas Hold'em",
      bType: 'blinds',
      stake: 1000,       // ₹100 SB (minor units)
      // minBuyIn: 100000,   // ₹1 000
      minBuyIn: 100000,   // ₹1 000
      maxBuyIn: 1000000,  // ₹10 000
      currency: 'INR',
      mode: 'cash',
      status: 'active',
    });
    process.stdout.write(`  PokerMode 'Low Stakes'  (stake=10000): ${modeA._id}\n`);

    // PokerMode B — High Stakes (₹500/₹1 000 blinds).
    const modeB = await PokerMode.create({
      pokerId: poker._id,
      gameType: "Texas Hold'em",
      bType: 'blinds',
      stake: 5000,        // ₹500 SB (minor units)
      minBuyIn: 500000,    // ₹5 000
      maxBuyIn: 5000000,   // ₹50 000
      currency: 'INR',
      mode: 'cash',
      status: 'active',
    });
    process.stdout.write(`  PokerMode 'High Stakes' (stake=50000): ${modeB._id}\n`);

    // PokerDesk for Low Stakes mode.
    // All money/gameType/currency/bType fields are denormalized from the mode.
    // minToStart and minToContinue use 3 (schema minimum — the schema has
    // min:[3,...] on both fields; task specified 2 which the validator rejects).
    const deskA = await PokerDesk.create({
      pokerModeId: modeA._id,
      tableName: 'Table 1',
      gameType: "Texas Hold'em",
      bType: 'blinds',
      mode: 'cash',
      isPractice: false,
      currency: 'INR',
      stake: 1000,
      minBuyIn: 100000,
      maxBuyIn: 1000000,
      minToStart: 3,
      minToContinue: 3,
      maxPlayerCount: 6,
      maxSeats: 6,
      status: 'active',
      seats: [],
    });
    process.stdout.write(`  PokerDesk Low  Stakes / Table 1: ${deskA._id}\n`);

    // PokerDesk for High Stakes mode.
    const deskB = await PokerDesk.create({
      pokerModeId: modeB._id,
      tableName: 'Table 1',
      gameType: "Texas Hold'em",
      bType: 'blinds',
      mode: 'cash',
      isPractice: false,
      currency: 'INR',
      stake: 5000,
      minBuyIn: 500000,
      maxBuyIn: 5000000,
      minToStart: 3,
      minToContinue: 3,
      maxPlayerCount: 6,
      maxSeats: 6,
      status: 'active',
      seats: [],
    });
    process.stdout.write(`  PokerDesk High Stakes / Table 1: ${deskB._id}\n`);

    // PokerMode C — Practice (same stake/buy-in as Low Stakes, no real money).
    const practiceMode = await PokerMode.create({
      pokerId: poker._id,
      gameType: "Texas Hold'em",
      bType: 'blinds',
      stake: 1000,
      minBuyIn: 100000,
      maxBuyIn: 1000000,
      currency: 'INR',
      mode: 'practice',
      status: 'active',
    });
    process.stdout.write(`  PokerMode 'Practice'    (stake=10000): ${practiceMode._id}\n`);

    // PokerDesk for Practice mode.
    const practiceDesk = await PokerDesk.create({
      pokerModeId: practiceMode._id,
      tableName: 'Practice Table 1',
      gameType: "Texas Hold'em",
      bType: 'blinds',
      mode: 'practice',
      isPractice: true,
      currency: 'INR',
      stake: 1000,
      minBuyIn: 100000,
      maxBuyIn: 1000000,
      minToStart: 3,
      minToContinue: 3,
      maxPlayerCount: 6,
      maxSeats: 6,
      status: 'active',
      seats: [],
    });
    process.stdout.write(`  Practice Desk: ${practiceDesk._id}\n`);

    process.stdout.write('\nDone. Lobby seed complete.\n');
  } finally {
    await mongoose.connection.close();
  }
}

main().catch((err) => {
  process.stderr.write(`\nUnhandled: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
});
