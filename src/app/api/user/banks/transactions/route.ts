import { NextRequest } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import dbConnect from '@/config/dbConnect';
import { DEFAULT_CURRENCY } from '@/config/constants';
import { requireUser } from '@/lib/auth/requireUser';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney, parseAmount } from '@/lib/api/money';
import BankAccount from '@/models/bankAccount';
import BankTransaction from '@/models/bankTransaction';
import type { IBankTransaction } from '@/models/bankTransaction';
import Wallet from '@/models/wallet';
import type { Types } from 'mongoose';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;
const DEFAULT_MAX_FILE_SIZE = 5_242_880; // 5 MB

type LeanBankTx = IBankTransaction & { _id: Types.ObjectId; createdAt: Date };

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireUser(req);
    await dbConnect();

    const sp = req.nextUrl.searchParams;
    const rawPage = parseInt(sp.get('page') ?? '1', 10);
    const rawLimit = parseInt(sp.get('limit') ?? String(DEFAULT_PAGE_LIMIT), 10);

    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(rawLimit, MAX_PAGE_LIMIT)
      : DEFAULT_PAGE_LIMIT;

    const [transactions, total] = await Promise.all([
      BankTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanBankTx[]>(),
      BankTransaction.countDocuments({ userId }),
    ]);

    const serialized = transactions.map((tx) => ({
      id: tx._id.toString(),
      bankAccountId: tx.bankAccountId.toString(),
      type: tx.type,
      status: tx.status,
      amount: serializeMoney(tx.amount, tx.currency),
      currency: tx.currency,
      imageUrl: tx.imageUrl ?? null,
      remark: tx.remark ?? null,
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

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireUser(req);
    await dbConnect();

    const formData = await req.formData();

    const type = formData.get('type');
    const bankAccountId = formData.get('bankAccountId');
    const amountRaw = formData.get('amount');

    if (!type || (type !== 'deposit' && type !== 'withdraw')) {
      throw new AuthError('MISSING_BANK_FIELD', 'type must be "deposit" or "withdraw"');
    }
    if (!bankAccountId || typeof bankAccountId !== 'string' || !bankAccountId.trim()) {
      throw new AuthError('MISSING_BANK_FIELD', 'bankAccountId is required');
    }
    if (amountRaw === null) {
      throw new AuthError('MISSING_BANK_FIELD', 'amount is required');
    }

    const parsedAmount = parseAmount(Number(amountRaw), DEFAULT_CURRENCY);

    const remark = formData.get('remark');

    const bankAccount = await BankAccount.findOne({
      _id: bankAccountId.trim(),
      userId,
      status: 'active',
    });
    if (!bankAccount) {
      throw new AuthError('INVALID_BANK_ACCOUNT', 'Bank account not found or not active');
    }

    let imageUrl: string | null = null;

    if (type === 'deposit') {
      const imageFile = formData.get('image');
      if (!imageFile || !(imageFile instanceof File)) {
        throw new AuthError('MISSING_IMAGE', 'A deposit receipt image is required');
      }

      const maxSize = parseInt(process.env.MAX_FILE_SIZE ?? String(DEFAULT_MAX_FILE_SIZE), 10);
      if (imageFile.size > maxSize) {
        throw new AuthError('MISSING_IMAGE', `Image exceeds maximum allowed size of ${maxSize} bytes`);
      }

      const uploadDir = process.env.UPLOAD_DIR ?? 'uploads';
      await mkdir(uploadDir, { recursive: true });

      const filename = `${Date.now()}-${imageFile.name}`;
      const filepath = path.join(uploadDir, filename);
      await writeFile(filepath, Buffer.from(await imageFile.arrayBuffer()));
      imageUrl = `${uploadDir}/${filename}`;
    }

    if (type === 'withdraw') {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet || wallet.balance < parsedAmount) {
        throw new AuthError('INSUFFICIENT_BALANCE', 'Wallet balance is insufficient for this withdrawal');
      }
    }

    const newTx = await BankTransaction.create({
      userId,
      bankAccountId: bankAccount._id,
      type,
      amount: parsedAmount,
      currency: DEFAULT_CURRENCY,
      imageUrl,
      remark: typeof remark === 'string' && remark.trim() ? remark.trim() : null,
    });

    return successResponse(
      {
        transaction: {
          id: newTx._id.toString(),
          bankAccountId: newTx.bankAccountId.toString(),
          type: newTx.type,
          status: newTx.status,
          amount: serializeMoney(newTx.amount, newTx.currency),
          currency: newTx.currency,
          imageUrl: newTx.imageUrl ?? null,
          remark: newTx.remark ?? null,
          completedAt: newTx.completedAt ?? null,
        },
      },
      201
    );
  } catch (err) {
    return errorResponse(err);
  }
}
