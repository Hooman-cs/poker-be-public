/**
 * @fileoverview Admin Single User Details API Route (App Router)
 * Fetches comprehensive profile, game stats, and financial history for a specific user.
 * Path: /api/admin/users/[userId]
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import User from '@/models/user';
import PokerGameArchive from '@/models/pokerGameArchive';
import BankTransaction from '@/models/bankTransaction';
import mongoose from 'mongoose';
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

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // 1. Establish Database Connection
    await dbConnect();

    // 2. Extract and Verify Authentication Token (Restoring Security)
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Authentication token is missing' }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as JwtPayload;
    if (!payload.userId || payload.role !== 'superadmin') {
      return NextResponse.json({ message: 'Unauthorized access' }, { status: 403 });
    }

    // 3. Validate User ID Parameter
    const { userId } = params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ message: 'Valid User ID is required' }, { status: 400 });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 4. Fetch Base User Data
    const user = await User.findById(userId).select('-password -__v').lean().exec();
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // 5. Execute Complex Aggregations in Parallel for Maximum Performance
    const [
      totalBetResult,
      totalWinResult,
      depositResult,
      withdrawalResult,
      bankTransactions
    ] = await Promise.all([
      // Total Bets Aggregation
      PokerGameArchive.aggregate([
        { $match: { 'players.userId': userObjectId } },
        { $unwind: '$players' },
        { $match: { 'players.userId': userObjectId } },
        { $group: { _id: null, totalBet: { $sum: '$players.totalBet' } } }
      ]),
      
      // Total Wins Aggregation
      PokerGameArchive.aggregate([
        { $unwind: '$pots' },
        { $unwind: '$pots.winners' },
        { $match: { 'pots.winners.userId': userObjectId } },
        { $group: { _id: null, totalWin: { $sum: '$pots.winners.amount' } } }
      ]),

      // Total Deposits Aggregation
      BankTransaction.aggregate([
        { $match: { userId: userObjectId, type: 'deposit', status: 'approved' } },
        { $group: { _id: null, totalDeposit: { $sum: '$amount' } } }
      ]),

      // Total Withdrawals Aggregation
      BankTransaction.aggregate([
        { $match: { userId: userObjectId, type: 'withdrawal', status: 'approved' } },
        { $group: { _id: null, totalWithdrawal: { $sum: '$amount' } } }
      ]),

      // Recent Transaction History (Limit to 50 for performance)
      BankTransaction.find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec()
    ]);

    // 6. Format and Return Payload
    return NextResponse.json({
      user,
      gameStats: {
        totalBet: totalBetResult[0]?.totalBet || 0,
        totalWinAmount: totalWinResult[0]?.totalWin || 0,
      },
      financialStats: {
        totalDeposit: depositResult[0]?.totalDeposit || 0,
        totalWithdrawal: withdrawalResult[0]?.totalWithdrawal || 0,
      },
      bankTransactions
    }, { status: 200 });

  } catch (error: any) {
    console.error(`[Get User Details API Error - ${params.userId}]:`, error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}