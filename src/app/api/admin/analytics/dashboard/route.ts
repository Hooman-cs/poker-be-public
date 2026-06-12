import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';
import { DEFAULT_CURRENCY } from '@/config/constants';
import type { Currency } from '@/config/constants';

import User from '@/models/user';
import BankTransaction from '@/models/bankTransaction';
import PokerDesk from '@/models/pokerDesk';
import PokerGameArchive from '@/models/pokerGameArchive';
import type { IUser } from '@/models/user';

type LeanUser = IUser & { _id: Types.ObjectId; createdAt: Date };

type LeaderboardEntry = {
  _id: Types.ObjectId;
  username: string;
  totalWinnings: number;
  currency: string;
};

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    await dbConnect();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      [totalUsers, activeUsers, newToday, newThisWeek, newThisMonth],
      [pendingDeposits, pendingWithdrawals, completedToday],
      [totalArchived, activeDesksNow, totalActiveDesks],
      [recentUsers],
      [leaderboard],
    ] = await Promise.all([

      // Group 1 — User stats
      Promise.all([
        User.countDocuments({}),
        User.countDocuments({ status: 'active' }),
        User.countDocuments({ createdAt: { $gte: startOfToday } }),
        User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      ]),

      // Group 2 — Bank transaction stats
      Promise.all([
        BankTransaction.countDocuments({ type: 'deposit', status: 'pending' }),
        BankTransaction.countDocuments({ type: 'withdraw', status: 'pending' }),
        BankTransaction.countDocuments({ status: 'completed', completedAt: { $gte: startOfToday } }),
      ]),

      // Group 3 — Game stats
      Promise.all([
        PokerGameArchive.countDocuments({ mode: 'cash' }),
        PokerDesk.countDocuments({ currentGameStatus: 'in-progress' }),
        PokerDesk.countDocuments({ status: 'active' }),
      ]),

      // Group 4 — Recent users (last 5)
      Promise.all([
        User.find({})
          .sort({ createdAt: -1 })
          .limit(5)
          .lean<LeanUser[]>(),
      ]),

      // Group 5 — Leaderboard: top 10 by net winnings across all archived games
      Promise.all([
        PokerGameArchive.aggregate<LeaderboardEntry>([
          { $match: { mode: 'cash' } },
          { $unwind: '$players' },
          {
            $group: {
              _id: '$players.userId',
              username: { $first: '$players.username' },
              totalWinnings: {
                $sum: { $subtract: ['$players.endingStack', '$players.startingStack'] },
              },
              currency: { $first: '$currency' },
            },
          },
          { $sort: { totalWinnings: -1 } },
          { $limit: 10 },
        ]),
      ]),
    ]);

    return successResponse({
      users: {
        total: totalUsers,
        active: activeUsers,
        newToday,
        newThisWeek,
        newThisMonth,
      },
      bankTransactions: {
        pendingDeposits,
        pendingWithdrawals,
        completedToday,
      },
      games: {
        totalArchived,
        activeDesksNow,
        totalActiveDesks,
      },
      recentUsers: recentUsers.map((u) => ({
        userId: u._id.toString(),
        username: u.username,
        email: u.email,
        status: u.status,
        createdAt: u.createdAt,
      })),
      leaderboard: leaderboard.map((entry) => ({
        userId: entry._id.toString(),
        username: entry.username,
        totalWinnings: serializeMoney(
          entry.totalWinnings,
          (entry.currency as Currency) ?? DEFAULT_CURRENCY
        ),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
