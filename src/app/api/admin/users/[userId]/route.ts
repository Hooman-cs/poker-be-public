/**
 * @fileoverview Admin Single User Details API
 * Fetches user profile, wallet, bank transactions and game stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import User from '@/models/user';
import Wallet from '@/models/wallet';
import WalletTransaction from '@/models/walletTransaction';
import BankTransaction from '@/models/bankTransaction';
import PokerGameArchive from '@/models/pokerGameArchive';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await dbConnect();

    const token = cookies().get('token')?.value;
    if (!token) {
      return NextResponse.json(
        { message: 'Authentication token is missing' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload?.userId || payload.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized access' },
        { status: 403 }
      );
    }

    const { userId } = params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { message: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [user, wallet] = await Promise.all([
      User.findById(userId).lean().exec(),
      Wallet.findOne({ userId }).lean().exec(),
    ]);

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    const [
      totalBetResult,
      totalWinResult,
      gamesPlayed,
      gamesWon,
      totalDepositResult,
      totalWithdrawResult,
      recentBankTransactions,
      recentWalletTransactions,
    ] = await Promise.all([
      PokerGameArchive.aggregate([
        { $match: { 'players.userId': userObjectId } },
        { $unwind: '$players' },
        { $match: { 'players.userId': userObjectId } },
        { $group: { _id: null, totalBet: { $sum: '$players.totalBet' } } },
      ]),
      PokerGameArchive.aggregate([
        { $unwind: '$pots' },
        { $unwind: '$pots.winners' },
        { $match: { 'pots.winners.playerId': userObjectId } },
        { $group: { _id: null, totalWin: { $sum: '$pots.winners.amount' } } },
      ]),
      PokerGameArchive.countDocuments({
        'players.userId': userObjectId,
      }),
      PokerGameArchive.countDocuments({
        'players.userId': userObjectId,
        'pots.winners.playerId': userObjectId,
      }),
      WalletTransaction.aggregate([
        {
          $match: {
            walletId: wallet?._id,
            type: { $in: ['deposit', 'pgDeposit'] },
            status: 'completed',
          },
        },
        { $group: { _id: null, total: { $sum: '$amount.total' } } },
      ]),
      WalletTransaction.aggregate([
        {
          $match: {
            walletId: wallet?._id,
            type: 'withdraw',
            status: 'completed',
          },
        },
        { $group: { _id: null, total: { $sum: '$amount.total' } } },
      ]),
      BankTransaction.find({ userId: userObjectId })
        .sort({ createdOn: -1 })
        .limit(10)
        .lean()
        .exec(),
      WalletTransaction.find({ walletId: wallet?._id })
        .sort({ createdOn: -1 })
        .limit(10)
        .lean()
        .exec(),
    ]);

    return NextResponse.json(
      {
        user: {
          _id: user._id,
          username: user.username,
          mobileNumber: user.mobileNumber,
          status: user.status,
          deviceType: user.deviceType,
          registrationDate: user.registrationDate,
          lastLogin: user.lastLogin,
        },
        wallet: {
          balance: wallet?.balance || 0,
          instantBonus: wallet?.instantBonus || 0,
          lockedBonus: wallet?.lockedBonus || 0,
        },
        gameStats: {
          gamesPlayed,
          gamesWon,
          totalBet: totalBetResult[0]?.totalBet || 0,
          totalWin: totalWinResult[0]?.totalWin || 0,
        },
        financialStats: {
          totalDeposit: totalDepositResult[0]?.total || 0,
          totalWithdraw: totalWithdrawResult[0]?.total || 0,
        },
        recentBankTransactions,
        recentWalletTransactions,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error(`[Admin User Details Error - ${params.userId}]:`, error.message);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
// /**
//  * @fileoverview Admin Single User Details API Route (App Router)
//  * Fetches comprehensive profile, game stats, and financial history for a specific user.
//  * Path: /api/admin/users/[userId]
//  */

// import { NextRequest, NextResponse } from 'next/server';
// import dbConnect from '@/config/dbConnect';
// import User from '@/models/user';
// import PokerGameArchive from '@/models/pokerGameArchive';
// import BankTransaction from '@/models/bankTransaction';
// import mongoose from 'mongoose';
// import { verifyToken } from '@/utils/jwt';
// import { cookies } from 'next/headers';

// // -----------------------------------------------------------------------------
// // Type Definitions
// // -----------------------------------------------------------------------------

// interface JwtPayload {
//   userId: string;
//   role: string;
// }

// // -----------------------------------------------------------------------------
// // Route Handler
// // -----------------------------------------------------------------------------

// export async function GET(
//   request: NextRequest,
//   { params }: { params: { userId: string } }
// ) {
//   try {
//     // 1. Establish Database Connection
//     await dbConnect();

//     // 2. Extract and Verify Authentication Token
//     const cookieStore = cookies();
//     const token = cookieStore.get('token')?.value;

//     if (!token) {
//       return NextResponse.json({ message: 'Authentication token is missing' }, { status: 401 });
//     }

//     const payload = (await verifyToken(token)) as JwtPayload;
//     if (!payload.userId || payload.role !== 'superadmin') {
//       return NextResponse.json({ message: 'Unauthorized access' }, { status: 403 });
//     }

//     // 3. Validate User ID
//     const { userId } = params;
//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return NextResponse.json({ message: 'Invalid user ID format' }, { status: 400 });
//     }

//     const userObjectId = new mongoose.Types.ObjectId(userId);

//     // 4. Fetch Base User Profile
//     const user = await User.findById(userObjectId)
//       .select('-password -__v -otp -otpExpires') // Exclude sensitive fields
//       .lean()
//       .exec();

//     if (!user) {
//       return NextResponse.json({ message: 'User not found' }, { status: 404 });
//     }

//     // 5. Execute Parallel Data Aggregations for Performance
//     const [totalBetResult, totalWinResult, depositResult, withdrawalResult] = await Promise.all([
      
//       // Total Bets Aggregation
//       PokerGameArchive.aggregate([
//         { $unwind: '$players' },
//         { $match: { 'players.userId': userObjectId } },
//         { $group: { _id: null, totalBet: { $sum: '$players.totalBet' } } }
//       ]),

//       // Total Winnings Aggregation
//       // FIXED (C3): Changed 'pots.winners.userId' to 'pots.winners.playerId' to match the database schema
//       PokerGameArchive.aggregate([
//         { $unwind: '$pots' },
//         { $unwind: '$pots.winners' },
//         { $match: { 'pots.winners.playerId': userObjectId } },
//         { $group: { _id: null, totalWin: { $sum: '$pots.winners.amount' } } }
//       ]),

//       // Total Deposits Aggregation
//       BankTransaction.aggregate([
//         { $match: { userId: userObjectId, type: 'deposit', status: 'approved' } },
//         { $group: { _id: null, totalDeposit: { $sum: '$amount' } } }
//       ]),

//       // Total Withdrawals Aggregation
//       BankTransaction.aggregate([
//         { $match: { userId: userObjectId, type: 'withdrawal', status: 'approved' } },
//         { $group: { _id: null, totalWithdrawal: { $sum: '$amount' } } }
//       ]),

//       // Recent Transaction History (Limit to 50 for performance)
//       BankTransaction.find({ userId: userObjectId })
//         .sort({ createdAt: -1 })
//         .limit(50)
//         .lean()
//         .exec()
//     ]);

//     // 6. Format and Return Payload
//     return NextResponse.json({
//       user,
//       gameStats: {
//         totalBet: totalBetResult[0]?.totalBet || 0,
//         totalWinAmount: totalWinResult[0]?.totalWin || 0,
//       },
//       financialStats: {
//         totalDeposit: depositResult[0]?.totalDeposit || 0,
//         totalWithdrawal: withdrawalResult[0]?.totalWithdrawal || 0,
//       }
//     }, { status: 200 });

//   } catch (error: any) {
//     console.error('Error fetching user details:', error);
//     return NextResponse.json({ 
//       message: 'Failed to fetch user details',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined 
//     }, { status: 500 });
//   }
// }