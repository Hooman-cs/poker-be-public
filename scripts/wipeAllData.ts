/**
 * @fileoverview wipeAllData.ts — full data reset, admin accounts preserved.
 *
 * Deletes ALL documents from:
 *   User, Wallet, WalletTransaction, BankAccount, BankTransaction,
 *   GatewayTransaction, Poker, PokerMode, PokerDesk, PokerGameArchive,
 *   PracticeSession
 *
 * Preserves:
 *   Admin, AppConfig
 *
 * Use this when you want a clean slate for fresh user testing without
 * losing your admin login or platform configuration.
 *
 * USAGE:
 *   npx tsx --env-file=.env.local scripts/wipeAllData.ts
 *
 * After running, reseed the lobby:
 *   npx tsx --env-file=.env.local scripts/seedLobby.ts
 *   npx tsx --env-file=.env.local scripts/seedPracticeDesks.ts
 */

import mongoose from 'mongoose';
import dbConnect from '@/config/dbConnect';
import User from '@/models/user';
import Wallet from '@/models/wallet';
import WalletTransaction from '@/models/walletTransaction';
import BankAccount from '@/models/bankAccount';
import BankTransaction from '@/models/bankTransaction';
import GatewayTransaction from '@/models/gatewayTransaction';
import Poker from '@/models/poker';
import PokerMode from '@/models/pokerMode';
import PokerDesk from '@/models/pokerDesk';
import PokerGameArchive from '@/models/pokerGameArchive';
import PracticeSession from '@/models/practiceSession';

async function main(): Promise<void> {
  process.stdout.write('=> Creating new database connection\n');
  await dbConnect();

  try {
    process.stdout.write('Wiping all data (admin preserved)...\n');

    const [
      users, wallets, walletTxs, banks, bankTxs,
      gatewayTxs, pokers, modes, desks, archives, sessions,
    ] = await Promise.all([
      User.deleteMany({}),
      Wallet.deleteMany({}),
      WalletTransaction.deleteMany({}),
      BankAccount.deleteMany({}),
      BankTransaction.deleteMany({}),
      GatewayTransaction.deleteMany({}),
      Poker.deleteMany({}),
      PokerMode.deleteMany({}),
      PokerDesk.deleteMany({}),
      PokerGameArchive.deleteMany({}),
      PracticeSession.deleteMany({}),
    ]);

    process.stdout.write(`  Users:             ${users.deletedCount} deleted\n`);
    process.stdout.write(`  Wallets:           ${wallets.deletedCount} deleted\n`);
    process.stdout.write(`  WalletTransactions:${walletTxs.deletedCount} deleted\n`);
    process.stdout.write(`  BankAccounts:      ${banks.deletedCount} deleted\n`);
    process.stdout.write(`  BankTransactions:  ${bankTxs.deletedCount} deleted\n`);
    process.stdout.write(`  GatewayTransactions:${gatewayTxs.deletedCount} deleted\n`);
    process.stdout.write(`  Pokers:            ${pokers.deletedCount} deleted\n`);
    process.stdout.write(`  PokerModes:        ${modes.deletedCount} deleted\n`);
    process.stdout.write(`  PokerDesks:        ${desks.deletedCount} deleted\n`);
    process.stdout.write(`  PokerGameArchives: ${archives.deletedCount} deleted\n`);
    process.stdout.write(`  PracticeSessions:  ${sessions.deletedCount} deleted\n`);

    process.stdout.write('\nDone. Admin accounts and AppConfig preserved.\n');
    process.stdout.write('Next steps:\n');
    process.stdout.write('  npx tsx --env-file=.env.local scripts/seedLobby.ts\n');
    process.stdout.write('  npx tsx --env-file=.env.local scripts/seedPracticeDesks.ts\n');
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
