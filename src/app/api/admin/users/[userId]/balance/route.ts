import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';
import { DEFAULT_CURRENCY } from '@/config/constants';
import type { Currency } from '@/config/constants';

import Wallet from '@/models/wallet';
import WalletTransaction from '@/models/walletTransaction';

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await requireAdmin(req);

    const { userId } = params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AuthError('NOT_FOUND', 'User not found');
    }

    const body = await req.json().catch(() => ({}));
    const { bonusAmount } = body as { bonusAmount?: unknown };

    if (
      typeof bonusAmount !== 'number' ||
      !Number.isInteger(bonusAmount) ||
      !Number.isSafeInteger(bonusAmount) ||
      bonusAmount === 0
    ) {
      throw new AuthError('INVALID_STATE', 'bonusAmount must be a non-zero safe integer');
    }

    await dbConnect();

    let newLockedBonus = 0;
    let walletCurrency: Currency = DEFAULT_CURRENCY;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const wallet = await Wallet.findOne({ userId }, null, { session });
        if (!wallet) {
          throw new AuthError('NOT_FOUND', 'Wallet not found');
        }

        if (wallet.lockedBonus + bonusAmount < 0) {
          throw new AuthError('INSUFFICIENT_BALANCE', 'Insufficient locked bonus balance');
        }

        newLockedBonus = wallet.lockedBonus + bonusAmount;
        walletCurrency = wallet.currency;

        await Wallet.updateOne(
          { userId },
          { $inc: { lockedBonus: bonusAmount } },
          { session }
        );

        await WalletTransaction.create(
          [
            {
              walletId: wallet._id,
              type: 'bonus',
              status: 'completed',
              amount: {
                lockedBonus: Math.abs(bonusAmount),
                total: Math.abs(bonusAmount),
              },
              currency: wallet.currency,
              remark: 'adminAdjustment',
              completedAt: new Date(),
            },
          ],
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return successResponse({
      message: 'Locked bonus updated',
      lockedBonus: serializeMoney(newLockedBonus, walletCurrency),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
