import { NextRequest } from 'next/server';

import dbConnect from '@/config/dbConnect';
import { requireUser } from '@/lib/auth/requireUser';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';
import Wallet from '@/models/wallet';
import WalletTransaction from '@/models/walletTransaction';
import type { ITransaction } from '@/models/walletTransaction';
import type { Currency } from '@/config/constants';
import type { Types } from 'mongoose';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function serializeAmount(
  amount: {
    cashAmount: number;
    instantBonus: number;
    lockedBonus: number;
    gst: number;
    tds: number;
    otherDeductions: number;
    total: number;
  },
  currency: Currency
) {
  return {
    cashAmount: serializeMoney(amount.cashAmount, currency),
    instantBonus: serializeMoney(amount.instantBonus, currency),
    lockedBonus: serializeMoney(amount.lockedBonus, currency),
    gst: serializeMoney(amount.gst, currency),
    tds: serializeMoney(amount.tds, currency),
    otherDeductions: serializeMoney(amount.otherDeductions, currency),
    total: serializeMoney(amount.total, currency),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireUser(req);
    await dbConnect();

    const searchParams = req.nextUrl.searchParams;

    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);

    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      throw new AuthError('NOT_FOUND', 'Wallet not found for this user');
    }

    type LeanTx = ITransaction & { _id: Types.ObjectId; createdAt: Date };

    const [transactions, total] = await Promise.all([
      WalletTransaction.find({ walletId: wallet._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanTx[]>(),
      WalletTransaction.countDocuments({ walletId: wallet._id }),
    ]);

    const currency = wallet.currency;

    const serialized = transactions.map((tx) => ({
      id: tx._id.toString(),
      type: tx.type,
      status: tx.status,
      amount: serializeAmount(tx.amount, currency),
      currency: tx.currency,
      remark: tx.remark ?? null,
      deskId: tx.deskId?.toString() ?? null,
      completedAt: tx.completedAt ?? null,
      createdAt: tx.createdAt,
    }));

    return successResponse({
      transactions: serialized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
