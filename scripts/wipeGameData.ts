/**
 * @fileoverview wipeGameData.ts — partial wipe.
 *
 * Deletes ALL documents from:
 *   Poker, PokerMode, PokerDesk, PokerGameArchive, PracticeSession
 *
 * Preserves:
 *   Users, Wallets, WalletTransactions, BankAccounts, BankTransactions,
 *   GatewayTransactions, AdminUsers, AppConfig
 *
 * Use this when you want to reseed the lobby and game data without
 * touching user accounts or payment records.
 *
 * USAGE:
 *   npx tsx --env-file=.env.local scripts/wipeGameData.ts
 */

import mongoose from 'mongoose';
import dbConnect from '@/config/dbConnect';
import Poker from '@/models/poker';
import PokerMode from '@/models/pokerMode';
import PokerDesk from '@/models/pokerDesk';
import PokerGameArchive from '@/models/pokerGameArchive';
import PracticeSession from '@/models/practiceSession';

async function main(): Promise<void> {
  process.stdout.write('=> Creating new database connection\n');
  await dbConnect();

  try {
    process.stdout.write('Wiping game data...\n');

    const [pokers, modes, desks, archives, sessions] = await Promise.all([
      Poker.deleteMany({}),
      PokerMode.deleteMany({}),
      PokerDesk.deleteMany({}),
      PokerGameArchive.deleteMany({}),
      PracticeSession.deleteMany({}),
    ]);

    process.stdout.write(`  Pokers:           ${pokers.deletedCount} deleted\n`);
    process.stdout.write(`  PokerModes:       ${modes.deletedCount} deleted\n`);
    process.stdout.write(`  PokerDesks:       ${desks.deletedCount} deleted\n`);
    process.stdout.write(`  PokerGameArchives:${archives.deletedCount} deleted\n`);
    process.stdout.write(`  PracticeSessions: ${sessions.deletedCount} deleted\n`);

    process.stdout.write('\nDone. Users, wallets, and admin accounts preserved.\n');
    process.stdout.write('Next: npx tsx --env-file=.env.local scripts/seedLobby.ts\n');
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
