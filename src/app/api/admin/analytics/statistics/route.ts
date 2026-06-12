import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';
import { DEFAULT_CURRENCY } from '@/config/constants';
import type { Currency } from '@/config/constants';

import User from '@/models/user';
import PokerGameArchive from '@/models/pokerGameArchive';
import WalletTransaction from '@/models/walletTransaction';

const WINDOW_DAYS = 30;

/** 'YYYY-MM-DD' for each of the last `n` days (UTC), oldest first, inclusive of today. */
function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/** UTC midnight `n - 1` days ago -- the inclusive start of the window. */
function windowStart(n: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (n - 1)));
}

type DayCount = { _id: string; count: number };
type DaySum = { _id: string; amount: number };
type LeaderboardRow = { _id: Types.ObjectId; username: string; totalWinnings: number; currency: string };

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    await dbConnect();

    const days = lastNDays(WINDOW_DAYS);
    const start = windowStart(WINDOW_DAYS);

    const [signupRows, cashGameRows, depositRows, leaderboardRows] = await Promise.all([
      User.aggregate<DayCount>([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      PokerGameArchive.aggregate<DayCount>([
        { $match: { mode: 'cash', completedAt: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
      ]),
      WalletTransaction.aggregate<DaySum>([
        { $match: { type: 'deposit', status: 'completed', completedAt: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, amount: { $sum: '$amount.cashAmount' } } },
      ]),
      PokerGameArchive.aggregate<LeaderboardRow>([
        { $match: { mode: 'cash' } },
        { $unwind: '$players' },
        {
          $group: {
            _id: '$players.userId',
            username: { $first: '$players.username' },
            totalWinnings: { $sum: { $subtract: ['$players.endingStack', '$players.startingStack'] } },
            currency: { $first: '$currency' },
          },
        },
        { $sort: { totalWinnings: -1 } },
        { $limit: 20 },
      ]),
    ]);

    const signupByDay = new Map(signupRows.map((r) => [r._id, r.count]));
    const cashGameByDay = new Map(cashGameRows.map((r) => [r._id, r.count]));
    const depositByDay = new Map(depositRows.map((r) => [r._id, r.amount]));

    const dailySignups = days.map((date) => ({ date, count: signupByDay.get(date) ?? 0 }));
    const dailyCashGames = days.map((date) => ({ date, count: cashGameByDay.get(date) ?? 0 }));
    const dailyDepositVolume = days.map((date) => ({ date, amount: depositByDay.get(date) ?? 0 }));

    const signups30d = dailySignups.reduce((sum, d) => sum + d.count, 0);
    const cashGames30d = dailyCashGames.reduce((sum, d) => sum + d.count, 0);
    const depositVolume30dRaw = dailyDepositVolume.reduce((sum, d) => sum + d.amount, 0);

    return successResponse({
      dailySignups,
      dailyCashGames,
      dailyDepositVolume,
      totals: {
        signups30d,
        cashGames30d,
        depositVolume30d: serializeMoney(depositVolume30dRaw, DEFAULT_CURRENCY),
      },
      leaderboard: leaderboardRows.map((entry) => ({
        userId: entry._id.toString(),
        username: entry.username,
        totalWinnings: serializeMoney(entry.totalWinnings, (entry.currency as Currency) ?? DEFAULT_CURRENCY),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
