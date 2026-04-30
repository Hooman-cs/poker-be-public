/**
 * @fileoverview Admin Dashboard Statistics API Route (App Router)
 * Fetches high-level metrics for Users, Bank Transactions, and Poker Games.
 * Heavily optimized using MongoDB $facet aggregations and Promise.all.
 * Path: GET /api/admin/analytics/dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import User from '@/models/user';
import BankTransaction from '@/models/bankTransaction';
import PokerGameArchive from '@/models/pokerGameArchive';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

interface JwtPayload {
  userId: string;
  role: string;
}

// -----------------------------------------------------------------------------
// Route Handler
// -----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Establish Database Connection
    await dbConnect();

    // 2. Security Check (Patched the legacy bypass vulnerability)
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Authentication token is missing' }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as JwtPayload;
    if (!payload.userId || payload.role !== 'superadmin') {
      return NextResponse.json({ message: 'Unauthorized access' }, { status: 403 });
    }

    // 3. Time Boundaries for "Today" metrics
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 4. Execute Parallel Database Queries
    const [userStatsResult, bankStatsResult, pokerStatsResult] = await Promise.all([
      
      // A. USER STATISTICS (Single DB Trip via $facet)
      User.aggregate([
        {
          $facet: {
            totalUsers: [{ $count: 'count' }],
            statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            deviceTypes: [{ $group: { _id: '$deviceType', count: { $sum: 1 } } }],
            registeredToday: [
              { $match: { registrationDate: { $gte: startOfDay, $lte: endOfDay } } },
              { $count: 'count' }
            ],
            topNewUsers: [
              { $sort: { registrationDate: -1 } },
              { $limit: 10 },
              { $project: { username: 1, registrationDate: 1 } }
            ]
          }
        }
      ]),

      // B. BANK TRANSACTION STATISTICS (Fixing the 'isToday' logic bug)
      BankTransaction.aggregate([
        {
          $match: {
            type: { $in: ['deposit', 'withdraw'] },
            status: { $in: ['completed', 'failed', 'pending'] } // Note: Standardized lowercase 'pending'
          }
        },
        {
          $facet: {
            overall: [
              { $group: { _id: { type: '$type', status: '$status' }, totalAmount: { $sum: '$amount' } } }
            ],
            today: [
              { $match: { createdOn: { $gte: startOfDay, $lte: endOfDay } } },
              { $group: { _id: { type: '$type', status: '$status' }, totalAmount: { $sum: '$amount' } } }
            ]
          }
        }
      ]),

      // C. POKER GAME STATISTICS (Cash-Mode Only)
      PokerGameArchive.aggregate([
        { $match: { mode: 'cash' } },
        {
          $facet: {
            totalFinishedGames: [
              { $match: { status: 'finished' } },
              { $count: 'total' }
            ],
            totalPotInFinishedGames: [
              { $match: { status: 'finished' } },
              { $group: { _id: null, totalPot: { $sum: '$totalBet' } } }
            ],
            mostPlayedPokerDesk: [
              { $group: { _id: '$deskId', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 1 }
            ],
            topPlayersByTotalBet: [
              { $unwind: '$players' },
              { $group: { _id: '$players.userId', totalBet: { $sum: '$players.totalBet' } } },
              { $sort: { totalBet: -1 } },
              { $limit: 10 },
              {
                $lookup: {
                  from: 'users',
                  localField: '_id',
                  foreignField: '_id',
                  as: 'userDetails'
                }
              },
              {
                $project: {
                  _id: 1,
                  totalBet: 1,
                  username: { $arrayElemAt: ['$userDetails.username', 0] }
                }
              }
            ]
          }
        }
      ])
    ]);

    // 5. Data Parsing & Formatting
    // --- User Data ---
    const uData = userStatsResult[0];
    const getStatusCount = (status: string) => uData.statusCounts.find((s: any) => s._id === status)?.count || 0;

    // --- Bank Data ---
    const bData = bankStatsResult[0];
    const bankStats = {
      totalDepositSuccessful: 0, totalDepositFailed: 0, totalPendingDeposit: 0,
      totalWithdrawSuccessful: 0, totalWithdrawFailed: 0, totalPendingWithdraw: 0,
      todaysDepositSuccessful: 0, todaysDepositFailed: 0,
      todaysWithdrawSuccessful: 0, todaysWithdrawFailed: 0
    };

    bData.overall.forEach((stat: any) => {
      if (stat._id.type === 'deposit') {
        if (stat._id.status === 'completed') bankStats.totalDepositSuccessful = stat.totalAmount;
        if (stat._id.status === 'failed') bankStats.totalDepositFailed = stat.totalAmount;
        if (stat._id.status === 'pending') bankStats.totalPendingDeposit = stat.totalAmount;
      } else if (stat._id.type === 'withdraw') {
        if (stat._id.status === 'completed') bankStats.totalWithdrawSuccessful = stat.totalAmount;
        if (stat._id.status === 'failed') bankStats.totalWithdrawFailed = stat.totalAmount;
        if (stat._id.status === 'pending') bankStats.totalPendingWithdraw = stat.totalAmount;
      }
    });

    bData.today.forEach((stat: any) => {
      if (stat._id.type === 'deposit') {
        if (stat._id.status === 'completed') bankStats.todaysDepositSuccessful = stat.totalAmount;
        if (stat._id.status === 'failed') bankStats.todaysDepositFailed = stat.totalAmount;
      } else if (stat._id.type === 'withdraw') {
        if (stat._id.status === 'completed') bankStats.todaysWithdrawSuccessful = stat.totalAmount;
        if (stat._id.status === 'failed') bankStats.todaysWithdrawFailed = stat.totalAmount;
      }
    });

    // --- Poker Data ---
    const pData = pokerStatsResult[0] || {};

    // 6. Return Payload
    return NextResponse.json({
      success: true,
      data: {
        userStats: {
          totalUsers: uData.totalUsers[0]?.count || 0,
          activeUsers: getStatusCount('active'),
          inactiveUsers: getStatusCount('inactive'),
          suspendedUsers: getStatusCount('suspended'),
          usersRegisteredToday: uData.registeredToday[0]?.count || 0,
          deviceTypeStats: uData.deviceTypes,
          topNewUsers: uData.topNewUsers
        },
        bankTransactionStats: bankStats,
        pokerGameStats: {
          totalFinishedGames: pData.totalFinishedGames?.[0]?.total || 0,
          totalPotInFinishedGames: pData.totalPotInFinishedGames?.[0]?.totalPot || 0,
          mostPlayedPokerDesk: pData.mostPlayedPokerDesk?.[0]?._id || null,
          topPlayersByTotalBet: pData.topPlayersByTotalBet || []
        }
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Dashboard Statistics API Error]:', error.message);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}