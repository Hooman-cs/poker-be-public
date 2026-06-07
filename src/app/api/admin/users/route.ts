import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';

import User from '@/models/user';
import Wallet from '@/models/wallet';
import type { IUser } from '@/models/user';
import type { IWallet } from '@/models/wallet';

type LeanUser = IUser & { _id: Types.ObjectId; createdAt: Date };
type LeanWallet = IWallet & { _id: Types.ObjectId };

const USER_STATUSES = new Set(['active', 'inactive', 'suspended']);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
    const search = searchParams.get('search')?.trim() ?? '';
    const statusParam = searchParams.get('status') ?? '';

    const filter: Record<string, unknown> = {};

    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ username: rx }, { email: rx }];
    }

    if (statusParam && USER_STATUSES.has(statusParam)) {
      filter.status = statusParam;
    }

    await dbConnect();

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<LeanUser[]>();

    const userIds = users.map((u) => u._id);
    const wallets = await Wallet.find({ userId: { $in: userIds } }).lean<LeanWallet[]>();

    const walletMap = new Map<string, LeanWallet>();
    for (const w of wallets) {
      walletMap.set(w.userId.toString(), w);
    }

    const result = users.map((u) => {
      const wallet = walletMap.get(u._id.toString()) ?? null;
      return {
        userId: u._id.toString(),
        username: u.username,
        email: u.email,
        status: u.status,
        mobileNumber: u.mobileNumber ?? null,
        usernameLocked: u.usernameLocked,
        createdAt: u.createdAt,
        wallet: wallet
          ? {
              balance: serializeMoney(wallet.balance, wallet.currency),
              instantBonus: serializeMoney(wallet.instantBonus, wallet.currency),
              lockedBonus: serializeMoney(wallet.lockedBonus, wallet.currency),
              currency: wallet.currency,
            }
          : null,
      };
    });

    return successResponse({
      users: result,
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
