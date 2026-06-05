import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { verifyGoogleToken } from '@/lib/auth/googleVerify';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';
import { signToken } from '@/utils/jwt';
import { generateGamerName } from '@/utils/helpers';

import User from '@/models/user';
import Wallet from '@/models/wallet';
import WalletTransaction from '@/models/walletTransaction';

import {
  SIGNUP_BONUS_MINOR,
  DEFAULT_CURRENCY,
  USER_TOKEN_TTL,
} from '@/config/constants';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const { idToken, deviceType } = body as {
      idToken?: unknown;
      deviceType?: unknown;
    };

    if (!idToken || typeof idToken !== 'string') {
      throw new AuthError('MISSING_ID_TOKEN', 'idToken is required');
    }

    const { email, googleUserId } = await verifyGoogleToken(idToken);

    let user = await User.findOne({
      'authProviders.provider': 'google',
      'authProviders.providerId': googleUserId,
    });

    let isNewUser = false;

    if (user) {
      if (user.status !== 'active') {
        throw new AuthError('ACCOUNT_SUSPENDED', 'This account has been suspended');
      }

      user.lastLogin = new Date();
      if (
        deviceType === 'android' ||
        deviceType === 'ios' ||
        deviceType === 'unknown'
      ) {
        user.deviceType = deviceType;
      }
      await user.save();
    } else {
      const username = generateGamerName();
      user = await User.create({
        email,
        username,
        usernameLocked: false,
        authProviders: [{ provider: 'google', providerId: googleUserId, email }],
      });
      isNewUser = true;
    }

    let wallet = await Wallet.findOne({ userId: user._id });

    if (!wallet) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          [wallet] = await Wallet.create(
            [
              {
                userId: user!._id,
                balance: SIGNUP_BONUS_MINOR,
                currency: DEFAULT_CURRENCY,
              },
            ],
            { session }
          );

          await WalletTransaction.create(
            [
              {
                walletId: wallet!._id,
                type: 'bonus',
                status: 'completed',
                amount: {
                  cashAmount: SIGNUP_BONUS_MINOR,
                  total: SIGNUP_BONUS_MINOR,
                },
                currency: DEFAULT_CURRENCY,
                remark: 'signupBonus',
                completedAt: new Date(),
              },
            ],
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
    }

    const token = signToken(
      { userId: user._id.toString(), role: 'user' },
      { expiresIn: USER_TOKEN_TTL }
    );

    return successResponse(
      {
        message: isNewUser ? 'Account created' : 'Login successful',
        token,
        userId: user._id.toString(),
        userName: user.username,
        isNewUser,
        usernameLocked: user.usernameLocked,
        wallet: {
          balance: serializeMoney(wallet!.balance, wallet!.currency),
          instantBonus: serializeMoney(wallet!.instantBonus, wallet!.currency),
          lockedBonus: serializeMoney(wallet!.lockedBonus, wallet!.currency),
          currency: wallet!.currency,
        },
      },
      isNewUser ? 201 : 200
    );
  } catch (err) {
    return errorResponse(err);
  }
}
