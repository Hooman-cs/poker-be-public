/**
 * @fileoverview Hard-reset script — deletes all operational data from the DB.
 * AppConfig is intentionally preserved (GST rate, deposit bonus settings).
 *
 * USAGE:
 *   npx tsx --env-file=.env.local scripts/wipeDb.ts
 *
 * After running, recreate the admin account and reseed the lobby:
 *   npx tsx --env-file=.env.local scripts/createAdmin.ts
 *   npx tsx --env-file=.env.local scripts/seedLobby.ts
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
import Admin from '@/models/admin';

async function main(): Promise<void> {
  process.stdout.write('=> Creating new database connection\n');
  await dbConnect();

  try {
    const collections: Array<{ name: string; model: { deleteMany(filter: object): Promise<{ deletedCount?: number }> } }> = [
      { name: 'User',              model: User },
      { name: 'Wallet',            model: Wallet },
      { name: 'WalletTransaction', model: WalletTransaction },
      { name: 'BankAccount',       model: BankAccount },
      { name: 'BankTransaction',   model: BankTransaction },
      { name: 'GatewayTransaction',model: GatewayTransaction },
      { name: 'Poker',             model: Poker },
      { name: 'PokerMode',         model: PokerMode },
      { name: 'PokerDesk',         model: PokerDesk },
      { name: 'PokerGameArchive',  model: PokerGameArchive },
      { name: 'PracticeSession',   model: PracticeSession },
      { name: 'Admin',             model: Admin },
    ];

    for (const { name, model } of collections) {
      const result = await model.deleteMany({});
      process.stdout.write(`  ${name}: ${result.deletedCount ?? 0} deleted\n`);
    }

    process.stdout.write('\nDatabase wiped. AppConfig preserved.\n');
    process.stdout.write('Next: npx tsx --env-file=.env.local scripts/createAdmin.ts\n');
    process.stdout.write('Then: npx tsx --env-file=.env.local scripts/seedLobby.ts\n');
  } finally {
    await mongoose.connection.close();
  }
}

main().catch((err) => {
  process.stderr.write(`\nUnhandled: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
});
