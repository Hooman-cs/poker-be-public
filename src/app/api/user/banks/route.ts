import { NextRequest } from 'next/server';

import dbConnect from '@/config/dbConnect';
import { requireUser } from '@/lib/auth/requireUser';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import BankAccount from '@/models/bankAccount';
import type { IBankAccount } from '@/models/bankAccount';
import type { Types } from 'mongoose';

const MAX_BANK_ACCOUNTS = 5;

type LeanBank = IBankAccount & { _id: Types.ObjectId; createdAt: Date };

function serializeBank(bank: LeanBank) {
  return {
    id: bank._id.toString(),
    accountNumber: bank.accountNumber,
    bankName: bank.bankName,
    ifscCode: bank.ifscCode,
    accountHolderName: bank.accountHolderName,
    isDefault: bank.isDefault,
    status: bank.status,
    createdAt: bank.createdAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireUser(req);
    await dbConnect();

    const banks = await BankAccount.find({ userId })
      .sort({ createdAt: -1 })
      .lean<LeanBank[]>();

    return successResponse({ banks: banks.map(serializeBank) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = requireUser(req);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const { accountNumber, bankName, ifscCode, accountHolderName } = body as {
      accountNumber?: unknown;
      bankName?: unknown;
      ifscCode?: unknown;
      accountHolderName?: unknown;
    };

    if (!accountNumber || typeof accountNumber !== 'string' || !accountNumber.trim()) {
      throw new AuthError('MISSING_BANK_FIELD', 'accountNumber is required');
    }
    if (!bankName || typeof bankName !== 'string' || !bankName.trim()) {
      throw new AuthError('MISSING_BANK_FIELD', 'bankName is required');
    }
    if (!ifscCode || typeof ifscCode !== 'string' || !ifscCode.trim()) {
      throw new AuthError('MISSING_BANK_FIELD', 'ifscCode is required');
    }
    if (!accountHolderName || typeof accountHolderName !== 'string' || !accountHolderName.trim()) {
      throw new AuthError('MISSING_BANK_FIELD', 'accountHolderName is required');
    }

    const count = await BankAccount.countDocuments({ userId });
    if (count >= MAX_BANK_ACCOUNTS) {
      throw new AuthError('BANK_LIMIT_REACHED', `Maximum of ${MAX_BANK_ACCOUNTS} bank accounts allowed`);
    }

    const newAccount = await BankAccount.create({
      userId,
      accountNumber: accountNumber.trim(),
      bankName: bankName.trim(),
      ifscCode: ifscCode.trim(),
      accountHolderName: accountHolderName.trim(),
      isDefault: count === 0,
    });

    const plain = newAccount.toObject() as unknown as LeanBank;

    return successResponse({ bank: serializeBank(plain) }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
