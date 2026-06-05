import { NextRequest } from 'next/server';

import dbConnect from '@/config/dbConnect';
import { requireUser } from '@/lib/auth/requireUser';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';
import Wallet from '@/models/wallet';

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireUser(req);
    await dbConnect();

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      throw new AuthError('NOT_FOUND', 'Wallet not found for this user');
    }

    return successResponse({
      wallet: {
        balance: serializeMoney(wallet.balance, wallet.currency),
        instantBonus: serializeMoney(wallet.instantBonus, wallet.currency),
        lockedBonus: serializeMoney(wallet.lockedBonus, wallet.currency),
        currency: wallet.currency,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
