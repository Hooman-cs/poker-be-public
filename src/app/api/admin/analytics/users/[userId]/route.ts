/**
 * @fileoverview Admin Single User Game Analytics API Route (App Router)
 * Fetches accurate win rates, fold rates, and total contributions for a specific user.
 * Path: GET /api/admin/analytics/users/[userId]
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import PokerGameArchive from '@/models/pokerGameArchive';
import User from '@/models/user';
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

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    // 3. Validate User ID
    const { userId } = params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ message: 'Invalid User ID' }, { status: 400 });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 4. Validate User Exists
    const user = await User.findById(userObjectId).select('username').lean().exec();
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // 5. Execute Accurate Parallel Aggregations (Fixes the $unwind erasure bug)
    const [
      gamesPlayed,
      totalBetResult,
      totalWinResult,
      totalFoldsResult,
      totalContributionsResult
    ] = await Promise.all([
      // A. Total Games Played (Count all documents where user is in players array)
      PokerGameArchive.countDocuments({ "players.userId": userObjectId }).exec(),

      // B. Total Bet Amount
      PokerGameArchive.aggregate([
        { $match: { "players.userId": userObjectId } },
        { $unwind: "$players" },
        { $match: { "players.userId": userObjectId } },
        { $group: { _id: null, totalBet: { $sum: "$players.totalBet" } } }
      ]),

      // C. Total Win Amount
      PokerGameArchive.aggregate([
        { $match: { "players.userId": userObjectId } },
        { $unwind: "$pots" },
        { $unwind: "$pots.winners" },
        { $match: { "pots.winners.playerId": userObjectId } },
        { $group: { _id: null, totalWins: { $sum: "$pots.winners.amount" } } }
      ]),

      // D. Total Folds
      PokerGameArchive.aggregate([
        { $match: { "players.userId": userObjectId } },
        { $unwind: "$players" },
        { $match: { "players.userId": userObjectId, "players.status": "folded" } },
        { $group: { _id: null, totalFolds: { $sum: 1 } } }
      ]),

      // E. Total Pot Contributions
      PokerGameArchive.aggregate([
        { $match: { "players.userId": userObjectId } },
        { $unwind: "$pots" },
        { $unwind: "$pots.contributors" },
        { $match: { "pots.contributors.playerId": userObjectId } },
        { $group: { _id: null, totalContributions: { $sum: "$pots.contributors.contribution" } } }
      ])
    ]);

    // 6. Safely Extract Data
    const totalBet = totalBetResult[0]?.totalBet || 0;
    const totalWins = totalWinResult[0]?.totalWins || 0;
    const totalFolds = totalFoldsResult[0]?.totalFolds || 0;
    const totalContributions = totalContributionsResult[0]?.totalContributions || 0;

    // 7. Calculate Ratios (Preventing Division by Zero)
    const winRate = gamesPlayed > 0 ? (totalWins / gamesPlayed) : 0;
    const foldRate = gamesPlayed > 0 ? (totalFolds / gamesPlayed) : 0;
    const betToWinRatio = totalWins > 0 ? (totalBet / totalWins) : 0;

    // 8. Return Final Payload
    return NextResponse.json({
      success: true,
      data: {
        userId: user._id,
        username: user.username,
        totalWins,
        totalBet,
        gamesPlayed,
        totalContributions,
        totalFolds,
        winRate,
        betToWinRatio,
        foldRate
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error(`[Single User Analytics Error - ${params.userId}]:`, error.message);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}