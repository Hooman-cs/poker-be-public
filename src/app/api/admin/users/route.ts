/**
 * @fileoverview Admin Users List API Route (App Router)
 * Handles fetching, filtering, and paginating the user list, including
 * deep financial aggregations (deposits, wins, bets) for the dashboard tables.
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import User from '@/models/user';
import PokerGameArchive from '@/models/pokerGameArchive';
import BankTransaction from '@/models/bankTransaction';
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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = searchParams.get('status');
    const searchName = searchParams.get('searchName');
    
    // Date parsing
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const finalStartDate = startDateParam ? new Date(startDateParam) : new Date('2000-01-01');
    const finalEndDate = endDateParam ? new Date(endDateParam) : new Date();

    // 4. Construct MongoDB Query Filters
    const userQuery: Record<string, any> = {
      registrationDate: { $gte: finalStartDate, $lte: finalEndDate },
    };

    if (status) userQuery.status = status;
    if (searchName) {
      userQuery.$or = [
        { username: { $regex: searchName, $options: 'i' } },
        { mobileNumber: { $regex: searchName, $options: 'i' } },
      ];
    }

    // 5. Fetch Base Users
    const users = await User.find(userQuery)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ registrationDate: -1 })
      .select('-password -__v')
      .lean()
      .exec();

    // 6. Map Through Users and Calculate Heavy Financial Stats
    // Using Promise.all to run user processing concurrently rather than sequentially
    const userDataPromises = users.map(async (user) => {
      // Run the 4 heavy database aggregations in parallel for EACH user
      const [
        totalDepositRes,
        totalWithdrawRes,
        totalBetRes,
        totalWinRes,
        gamesPlayed,
        gamesWon
      ] = await Promise.all([
        BankTransaction.aggregate([
          { $match: { userId: user._id, type: 'deposit', status: 'approved' } },
          { $group: { _id: null, totalDeposit: { $sum: '$amount' } } }
        ]),
        BankTransaction.aggregate([
          { $match: { userId: user._id, type: 'withdrawal', status: 'approved' } },
          { $group: { _id: null, totalWithdraw: { $sum: '$amount' } } }
        ]),
        PokerGameArchive.aggregate([
          { $match: { 'players.userId': user._id } },
          { $unwind: '$players' },
          { $match: { 'players.userId': user._id } },
          { $group: { _id: null, totalBet: { $sum: '$players.totalBet' } } }
        ]),
        PokerGameArchive.aggregate([
          { $unwind: '$pots' },
          { $unwind: '$pots.winners' },
          { $match: { 'pots.winners.playerId': user._id } },
          { $group: { _id: null, totalWin: { $sum: '$pots.winners.amount' } } }
        ]),
        PokerGameArchive.countDocuments({ 'players.userId': user._id }),
        PokerGameArchive.countDocuments({ 'players.userId': user._id, 'pots.winners.playerId': user._id })
      ]);

      // Return the heavily formatted user object
      return {
        _id: user._id,
        username: user.username,
        status: user.status,
        mobileNumber: user.mobileNumber,
        walletBalance: parseFloat(user.wallet?.balance?.toFixed(2) || '0'),
        totalDeposit: totalDepositRes[0]?.totalDeposit || 0,
        totalWithdraw: totalWithdrawRes[0]?.totalWithdraw || 0,
        gamesPlayed,
        gamesWon,
        totalBet: totalBetRes[0]?.totalBet || 0,
        totalWin: totalWinRes[0]?.totalWin || 0,
      };
    });

    const enrichedUserData = await Promise.all(userDataPromises);
    const totalUsers = await User.countDocuments(userQuery).exec();

    // 7. Return Final Payload
    return NextResponse.json(
      {
        users: enrichedUserData,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
        currentPage: page,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[Get Users List API Error]:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}