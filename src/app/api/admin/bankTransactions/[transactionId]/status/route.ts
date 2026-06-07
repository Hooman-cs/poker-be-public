import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';
import { GST_MULTIPLIER } from '@/config/constants';

import BankTransaction from '@/models/bankTransaction';
import Wallet from '@/models/wallet';
import WalletTransaction from '@/models/walletTransaction';
import AppConfig from '@/models/appConfig';
import type { IBankTransaction } from '@/models/bankTransaction';
import type { IWallet } from '@/models/wallet';

type LeanBankTx = IBankTransaction & { _id: Types.ObjectId };
type LeanWallet = IWallet & { _id: Types.ObjectId };

const VALID_NEW_STATUSES = new Set(['completed', 'failed']);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    await requireAdmin(req);

    const { transactionId } = params;

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      throw new AuthError('NOT_FOUND', 'Bank transaction not found');
    }

    const body = await req.json().catch(() => ({}));
    const { status: newStatus } = body as { status?: unknown };

    if (typeof newStatus !== 'string' || !VALID_NEW_STATUSES.has(newStatus)) {
      throw new AuthError('INVALID_STATE', 'status must be "completed" or "failed"');
    }

    await dbConnect();

    const tx = await BankTransaction.findById(transactionId).lean<LeanBankTx>();
    if (!tx) {
      throw new AuthError('NOT_FOUND', 'Bank transaction not found');
    }

    // Double-processing guard — must fire before any session is opened
    if (tx.status !== 'pending') {
      throw new AuthError('INVALID_STATE', 'Transaction has already been processed');
    }

    // Failed path — no wallet writes, no session needed
    if (newStatus === 'failed') {
      await BankTransaction.findByIdAndUpdate(
        transactionId,
        { status: 'failed', completedAt: new Date() },
        { runValidators: true }
      );
      return successResponse({ message: 'Bank transaction rejected' });
    }

    // Completed path — load AppConfig outside the session (read-only)
    const appConfig = await AppConfig.findOne({});
    const gstMultiplier = appConfig?.gstMultiplier ?? GST_MULTIPLIER;
    const depositBonusRate = appConfig?.depositBonusRate ?? 1.0;

    let credited: string | null = null;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const wallet = await Wallet.findOne(
          { userId: tx.userId },
          null,
          { session }
        ).lean<LeanWallet>();

        if (!wallet) {
          throw new AuthError('NOT_FOUND', 'Wallet not found');
        }

        if (tx.type === 'deposit') {
          const gross = tx.amount;
          const cashAmount = Math.round(gross / gstMultiplier);
          const gstAmount = gross - cashAmount;
          const bonusAmount = Math.round(gstAmount * depositBonusRate);

          await Wallet.updateOne(
            { _id: wallet._id },
            { $inc: { balance: cashAmount, instantBonus: bonusAmount } },
            { session }
          );

          await WalletTransaction.create(
            [
              {
                walletId: wallet._id,
                type: 'deposit',
                status: 'completed',
                amount: {
                  cashAmount,
                  instantBonus: bonusAmount,
                  gst: gstAmount,
                  total: gross,
                },
                currency: tx.currency,
                remark: 'bankDeposit',
                bankTransactionId: tx._id,
                completedAt: new Date(),
              },
            ],
            { session }
          );

          credited = serializeMoney(cashAmount, tx.currency);
        } else {
          // withdraw — balance check inside session
          if (wallet.balance < tx.amount) {
            throw new AuthError('INSUFFICIENT_BALANCE', 'Insufficient wallet balance');
          }

          await Wallet.updateOne(
            { _id: wallet._id },
            { $inc: { balance: -tx.amount } },
            { session }
          );

          await WalletTransaction.create(
            [
              {
                walletId: wallet._id,
                type: 'withdraw',
                status: 'completed',
                amount: {
                  cashAmount: tx.amount,
                  total: tx.amount,
                },
                currency: tx.currency,
                remark: 'bankWithdraw',
                bankTransactionId: tx._id,
                completedAt: new Date(),
              },
            ],
            { session }
          );
        }

        await BankTransaction.findByIdAndUpdate(
          transactionId,
          { status: 'completed', completedAt: new Date() },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    const responseBody: Record<string, unknown> = {
      message: tx.type === 'deposit' ? 'Deposit approved' : 'Withdrawal approved',
    };
    if (credited !== null) responseBody.credited = credited;

    return successResponse(responseBody);
  } catch (err) {
    return errorResponse(err);
  }
}
