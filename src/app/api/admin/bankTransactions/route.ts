import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';

import BankTransaction from '@/models/bankTransaction';
import type { IBankTransaction } from '@/models/bankTransaction';
import type { IBankAccount } from '@/models/bankAccount';

type LeanBankAccount = IBankAccount & { _id: Types.ObjectId };

type PopulatedTransaction = Omit<IBankTransaction, 'bankAccountId'> & {
  _id: Types.ObjectId;
  createdAt: Date;
  bankAccountId: LeanBankAccount | null;
};

const VALID_STATUSES = new Set(['pending', 'completed', 'failed']);
const VALID_TYPES = new Set(['deposit', 'withdraw']);

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
    const statusParam = searchParams.get('status') ?? '';
    const typeParam = searchParams.get('type') ?? '';
    const userIdParam = searchParams.get('userId') ?? '';

    const filter: Record<string, unknown> = {};

    if (statusParam && VALID_STATUSES.has(statusParam)) {
      filter.status = statusParam;
    }

    if (typeParam && VALID_TYPES.has(typeParam)) {
      filter.type = typeParam;
    }

    if (userIdParam && mongoose.Types.ObjectId.isValid(userIdParam)) {
      filter.userId = new mongoose.Types.ObjectId(userIdParam);
    }

    await dbConnect();

    const total = await BankTransaction.countDocuments(filter);
    const txs = await BankTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('bankAccountId')
      .lean<PopulatedTransaction[]>();

    const transactions = txs.map((tx) => {
      const acct = tx.bankAccountId;
      return {
        transactionId: tx._id.toString(),
        userId: tx.userId.toString(),
        type: tx.type,
        amount: serializeMoney(tx.amount, tx.currency),
        currency: tx.currency,
        status: tx.status,
        imageUrl: tx.imageUrl ?? null,
        remark: tx.remark ?? null,
        completedAt: tx.completedAt ?? null,
        createdAt: tx.createdAt,
        bankAccount: acct
          ? {
              bankId: acct._id.toString(),
              accountNumber: acct.accountNumber,
              bankName: acct.bankName,
              ifscCode: acct.ifscCode,
              accountHolderName: acct.accountHolderName,
              isDefault: acct.isDefault,
              status: acct.status,
            }
          : null,
      };
    });

    return successResponse({
      transactions,
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
