import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { ServiceError } from '@/services/gameService';
import { serializeMoney } from '@/lib/api/money';

import User from '@/models/user';
import Wallet from '@/models/wallet';
import BankAccount from '@/models/bankAccount';
import type { IUser } from '@/models/user';
import type { IWallet } from '@/models/wallet';
import type { IBankAccount } from '@/models/bankAccount';

type LeanUser = IUser & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
type LeanWallet = IWallet & { _id: Types.ObjectId };
type LeanBank = IBankAccount & { _id: Types.ObjectId; createdAt: Date };

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await requireAdmin(req);

    const { userId } = params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ServiceError('NOT_FOUND', 'User not found');
    }

    await dbConnect();

    const [user, wallet, banks] = await Promise.all([
      User.findById(userId).lean<LeanUser>(),
      Wallet.findOne({ userId }).lean<LeanWallet>(),
      BankAccount.find({ userId }).sort({ createdAt: -1 }).lean<LeanBank[]>(),
    ]);

    if (!user) {
      throw new ServiceError('NOT_FOUND', 'User not found');
    }

    return successResponse({
      user: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        status: user.status,
        mobileNumber: user.mobileNumber ?? null,
        usernameLocked: user.usernameLocked,
        deviceType: user.deviceType,
        lastLogin: user.lastLogin ?? null,
        authProviders: user.authProviders.map((p) => ({
          provider: p.provider,
          providerId: p.providerId,
          linkedAt: p.linkedAt,
        })),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      wallet: wallet
        ? {
            balance: serializeMoney(wallet.balance, wallet.currency),
            instantBonus: serializeMoney(wallet.instantBonus, wallet.currency),
            lockedBonus: serializeMoney(wallet.lockedBonus, wallet.currency),
            currency: wallet.currency,
          }
        : null,
      banks: banks.map((b) => ({
        bankId: b._id.toString(),
        accountNumber: b.accountNumber,
        bankName: b.bankName,
        ifscCode: b.ifscCode,
        accountHolderName: b.accountHolderName,
        isDefault: b.isDefault,
        status: b.status,
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
