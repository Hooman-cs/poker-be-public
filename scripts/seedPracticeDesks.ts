/**
 * @fileoverview seedPracticeDesks.ts — creates 20 practice desks for frontend testing.
 *
 * Creates:
 *   1 Poker  (upserts existing "Texas Hold'em" if present)
 *   1 PokerMode  (mode: 'practice', stake: ₹100 SB)
 *   20 PokerDesks  (isPractice: true, 6 seats each)
 *
 * Idempotent: exits early if a PokerMode with the seed description already exists.
 *
 * USAGE:
 *   npx tsx --env-file=.env.local scripts/seedPracticeDesks.ts
 *
 * After running, paste any "Practice Table N" deskId into the frontend's
 * `practice` socket event to start a game.
 */

import mongoose from 'mongoose';
import dbConnect from '@/config/dbConnect';
import Poker from '@/models/poker';
import PokerMode from '@/models/pokerMode';
import PokerDesk from '@/models/pokerDesk';

const DESK_COUNT = 20;
const SEED_MARKER = 'practice-seed-v1'; // stored in PokerMode.description for idempotency

async function main(): Promise<void> {
  process.stdout.write('=> Creating new database connection\n');
  await dbConnect();

  try {
    // ── Idempotency check ────────────────────────────────────────────────────
    const existing = await PokerMode.findOne({ description: SEED_MARKER }).lean();
    if (existing) {
      process.stdout.write('Practice seed already exists — printing IDs and exiting.\n\n');
      const desks = await PokerDesk.find({ pokerModeId: existing._id })
        .sort({ tableName: 1 })
        .lean();
      for (const d of desks) {
        process.stdout.write(`  ${d.tableName}: ${d._id}\n`);
      }
      return;
    }

    process.stdout.write(`Seeding ${DESK_COUNT} practice desks...\n`);

    // ── Poker ────────────────────────────────────────────────────────────────
    // Upsert so we don't collide with the unique gameType index.
    const poker = await Poker.findOneAndUpdate(
      { gameType: "Texas Hold'em" },
      { $set: { status: 'active' } },
      { upsert: true, new: true },
    );
    process.stdout.write(`  Poker:     ${poker._id}\n`);

    // ── PokerMode ────────────────────────────────────────────────────────────
    const practiceMode = await PokerMode.create({
      pokerId: poker._id,
      gameType: "Texas Hold'em",
      bType: 'blinds',
      mode: 'practice',
      description: SEED_MARKER,   // idempotency key
      stake: 1000,               // ₹100 SB — irrelevant for practice but required
      minBuyIn: 100000,           // ₹1 000
      maxBuyIn: 1000000,          // ₹10 000
      currency: 'INR',
      status: 'active',
    });
    process.stdout.write(`  PokerMode: ${practiceMode._id}\n\n`);

    // ── PokerDesks ───────────────────────────────────────────────────────────
    const deskDocs = Array.from({ length: DESK_COUNT }, (_, i) => ({
      pokerModeId: practiceMode._id,
      tableName: `Practice Table ${i + 1}`,
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
    }));

    const desks = await PokerDesk.insertMany(deskDocs);

    for (const d of desks) {
      process.stdout.write(`  ${d.tableName.padEnd(22)}: ${d._id}\n`);
    }

    process.stdout.write(`\nDone. ${DESK_COUNT} practice desks ready.\n`);
    process.stdout.write(
      '\nConnect any deskId above to the socket `practice` event to start a game.\n',
    );
  } finally {
    await mongoose.connection.close();
  }
}

main().catch((err) => {
  process.stderr.write(
    `Unhandled: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exitCode = 1;
});
