/**
 * @fileoverview Admin Game Analytics API Route (App Router)
 * Fetches overall game statistics, top winners, and top contributors from the Game Archive.
 * Optimized with parallel MongoDB aggregations.
 * Path: GET /api/admin/analytics/games
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import PokerGameArchive from '@/models/pokerGameArchive';
import PokerDesk from '@/models/pokerDesk';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';

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

    // 2. Authentication & Authorization Check
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Authentication token is missing' }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as JwtPayload;
    if (!payload.userId || payload.role !== 'superadmin') {
      return NextResponse.json({ message: 'Unauthorized access' }, { status: 403 });
    }

    // 3. Parse URL Search Parameters
    const searchParams = request.nextUrl.searchParams;
    const deskId = searchParams.get('deskId');
    const pokerModeId = searchParams.get('pokerModeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 4. Construct Match Stage (Filter Criteria)
    const matchStage: Record<string, any> = {};

    if (deskId && mongoose.Types.ObjectId.isValid(deskId)) {
      matchStage.deskId = new mongoose.Types.ObjectId(deskId);
    }

    // If filtering by Mode, fetch associated Desk IDs first
    if (pokerModeId && mongoose.Types.ObjectId.isValid(pokerModeId)) {
      const pokerDesks = await PokerDesk.find({ pokerModeId }).select('_id').lean().exec();
      const deskIds = pokerDesks.map(desk => desk._id);
      matchStage.deskId = { $in: deskIds };
    }

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    // 5. Execute Optimized Parallel Aggregations
    const [overallStatsResult, topWinners, topContributors] = await Promise.all([
      
      // A. Overall Stats
      PokerGameArchive.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalGames: { $sum: 1 },
            totalBet: { $sum: "$totalBet" }
          }
        }
      ]),

      // B. Top 10 Winners
      PokerGameArchive.aggregate([
        { $match: matchStage },
        { $unwind: "$pots" },
        { $unwind: "$pots.winners" },
        {
          $group: {
            _id: "$pots.winners.playerId",
            totalWinAmount: { $sum: "$pots.winners.amount" }
          }
        },
        { $sort: { totalWinAmount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $project: {
            userId: "$user._id",
            username: "$user.username",
            totalWinAmount: 1,
            _id: 0
          }
        }
      ]),

      // C. Top 10 Contributors
      PokerGameArchive.aggregate([
        { $match: matchStage },
        { $unwind: "$pots" },
        { $unwind: "$pots.contributors" },
        {
          $group: {
            _id: "$pots.contributors.playerId",
            totalContributed: { $sum: "$pots.contributors.contribution" }
          }
        },
        { $sort: { totalContributed: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $project: {
            userId: "$user._id",
            username: "$user.username",
            totalContributed: 1,
            _id: 0
          }
        }
      ])
    ]);

    // 6. Format and Return Payload
    const overallStats = overallStatsResult[0] || { totalGames: 0, totalBet: 0 };

    return NextResponse.json({
      success: true,
      data: {
        totalGames: overallStats.totalGames,
        totalBet: overallStats.totalBet,
        topWinners,
        topContributors
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Analytics Games API Error]:', error.message);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}