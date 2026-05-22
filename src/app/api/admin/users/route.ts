/**
 * @fileoverview Admin Users List API
 * Fetches paginated user list with wallet balances and game stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import User from '@/models/user';
import Wallet from '@/models/wallet';
import WalletTransaction from '@/models/walletTransaction';
import PokerGameArchive from '@/models/pokerGameArchive';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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
    // if (!payload?.userId || payload.role !== 'admin') {
    //   return NextResponse.json(
    //     { message: 'Unauthorized access' },
    //     { status: 403 }
    //   );
    // }
    if (!payload?.userId || payload.role !== 'superadmin') {
      return NextResponse.json(
        { message: 'Unauthorized access' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '10', 10));
    const status = searchParams.get('status');
    const searchName = searchParams.get('searchName');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const query: any = {};
    if (status) query.status = status;
    if (searchName) {
      query.$or = [
        { username: { $regex: searchName, $options: 'i' } },
        { mobileNumber: { $regex: searchName, $options: 'i' } },
      ];
    }
    if (startDate || endDate) {
      query.registrationDate = {};
      if (startDate) query.registrationDate.$gte = new Date(startDate);
      if (endDate) query.registrationDate.$lte = new Date(endDate);
    }

    const [users, totalUsers] = await Promise.all([
      User.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ registrationDate: -1 })
        .lean()
        .exec(),
      User.countDocuments(query).exec(),
    ]);

    const userIds = users.map((u) => u._id);

    const wallets = await Wallet.find({ userId: { $in: userIds } })
      .select('userId balance instantBonus lockedBonus')
      .lean()
      .exec();

    const walletMap = wallets.reduce((acc: any, w) => {
      acc[w.userId.toString()] = w;
      return acc;
    }, {});

    const walletIds = wallets.map((w) => w._id);

    const [depositAgg, withdrawAgg, gameStats] = await Promise.all([
      WalletTransaction.aggregate([
        {
          $match: {
            walletId: { $in: walletIds },
            type: 'deposit',
            status: 'completed',
          },
        },
        {
          $group: {
            _id: '$walletId',
            totalDeposit: { $sum: '$amount.total' },
          },
        },
      ]),
      WalletTransaction.aggregate([
        {
          $match: {
            walletId: { $in: walletIds },
            type: 'withdraw',
            status: 'completed',
          },
        },
        {
          $group: {
            _id: '$walletId',
            totalWithdraw: { $sum: '$amount.total' },
          },
        },
      ]),
      PokerGameArchive.aggregate([
        { $match: { 'players.userId': { $in: userIds } } },
        { $unwind: '$players' },
        { $match: { 'players.userId': { $in: userIds } } },
        {
          $group: {
            _id: '$players.userId',
            gamesPlayed: { $sum: 1 },
            totalBet: { $sum: '$players.totalBet' },
          },
        },
      ]),
    ]);

    const depositMap = depositAgg.reduce((acc: any, d) => {
      acc[d._id.toString()] = d.totalDeposit;
      return acc;
    }, {});

    const withdrawMap = withdrawAgg.reduce((acc: any, w) => {
      acc[w._id.toString()] = w.totalWithdraw;
      return acc;
    }, {});

    const gameStatsMap = gameStats.reduce((acc: any, g) => {
      acc[g._id.toString()] = g;
      return acc;
    }, {});

    const enrichedUsers = users.map((user) => {
      const wallet = walletMap[user._id.toString()];
      const walletId = wallet?._id?.toString();
      const stats = gameStatsMap[user._id.toString()];

      return {
        _id: user._id,
        username: user.username,
        mobileNumber: user.mobileNumber,
        status: user.status,
        deviceType: user.deviceType,
        registrationDate: user.registrationDate,
        lastLogin: user.lastLogin,
        wallet: {
          balance: wallet?.balance || 0,
          instantBonus: wallet?.instantBonus || 0,
          lockedBonus: wallet?.lockedBonus || 0,
        },
        totalDeposit: depositMap[walletId] || 0,
        totalWithdraw: withdrawMap[walletId] || 0,
        gamesPlayed: stats?.gamesPlayed || 0,
        totalBet: stats?.totalBet || 0,
      };
    });

    return NextResponse.json(
      {
        users: enrichedUsers,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
        currentPage: page,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[Admin Users List Error]:', error.message);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
// /**
//  * @fileoverview Admin Users List API Route (App Router)
//  * Handles fetching, filtering, and paginating the user list, including
//  * deep financial aggregations (deposits, wins, bets) for the dashboard tables.
//  */

// import { NextRequest, NextResponse } from 'next/server';
// import dbConnect from '@/config/dbConnect';
// import User from '@/models/user';
// import PokerGameArchive from '@/models/pokerGameArchive';
// import BankTransaction from '@/models/bankTransaction';
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

// export async function GET(request: NextRequest) {
//   try {
//     // 1. Establish Database Connection
//     await dbConnect();

//     // 2. Authentication & Authorization Check
//     const cookieStore = cookies();
//     const token = cookieStore.get('token')?.value;

//     if (!token) {
//       return NextResponse.json({ message: 'Authentication token is missing' }, { status: 401 });
//     }

//     const payload = (await verifyToken(token)) as JwtPayload;
//     if (!payload.userId || payload.role !== 'superadmin') {
//       return NextResponse.json({ message: 'Unauthorized access' }, { status: 403 });
//     }

//     // 3. Parse URL Search Parameters
//     const searchParams = request.nextUrl.searchParams;
//     const page = parseInt(searchParams.get('page') || '1', 10);
//     const limit = parseInt(searchParams.get('limit') || '10', 10);
//     const status = searchParams.get('status');
//     const searchName = searchParams.get('searchName');
    
//     // Date parsing
//     const startDateParam = searchParams.get('startDate');
//     const endDateParam = searchParams.get('endDate');
//     const finalStartDate = startDateParam ? new Date(startDateParam) : new Date('2000-01-01');
//     const finalEndDate = endDateParam ? new Date(endDateParam) : new Date();

//     // 4. Construct MongoDB Query Filters
//     const userQuery: Record<string, any> = {
//       registrationDate: { $gte: finalStartDate, $lte: finalEndDate },
//     };

//     if (status) userQuery.status = status;
//     if (searchName) {
//       userQuery.$or = [
//         { username: { $regex: searchName, $options: 'i' } },
//         { mobileNumber: { $regex: searchName, $options: 'i' } },
//       ];
//     }

//     // 5. Fetch Base Users
//     const users = await User.find(userQuery)
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .sort({ registrationDate: -1 })
//       .select('-password -__v')
//       .lean()
//       .exec();

//     // 6. Map Through Users and Calculate Heavy Financial Stats
//     // Using Promise.all to run user processing concurrently rather than sequentially
//     const userDataPromises = users.map(async (user) => {
//       // Run the 4 heavy database aggregations in parallel for EACH user
//       const [
//         totalDepositRes,
//         totalWithdrawRes,
//         totalBetRes,
//         totalWinRes,
//         gamesPlayed,
//         gamesWon
//       ] = await Promise.all([
//         BankTransaction.aggregate([
//           { $match: { userId: user._id, type: 'deposit', status: 'approved' } },
//           { $group: { _id: null, totalDeposit: { $sum: '$amount' } } }
//         ]),
//         BankTransaction.aggregate([
//           { $match: { userId: user._id, type: 'withdrawal', status: 'approved' } },
//           { $group: { _id: null, totalWithdraw: { $sum: '$amount' } } }
//         ]),
//         PokerGameArchive.aggregate([
//           { $match: { 'players.userId': user._id } },
//           { $unwind: '$players' },
//           { $match: { 'players.userId': user._id } },
//           { $group: { _id: null, totalBet: { $sum: '$players.totalBet' } } }
//         ]),
//         PokerGameArchive.aggregate([
//           { $unwind: '$pots' },
//           { $unwind: '$pots.winners' },
//           { $match: { 'pots.winners.playerId': user._id } },
//           { $group: { _id: null, totalWin: { $sum: '$pots.winners.amount' } } }
//         ]),
//         PokerGameArchive.countDocuments({ 'players.userId': user._id }),
//         PokerGameArchive.countDocuments({ 'players.userId': user._id, 'pots.winners.playerId': user._id })
//       ]);

//       // Return the heavily formatted user object
//       return {
//         _id: user._id,
//         username: user.username,
//         status: user.status,
//         mobileNumber: user.mobileNumber,
//         walletBalance: parseFloat(user.wallet?.balance?.toFixed(2) || '0'),
//         totalDeposit: totalDepositRes[0]?.totalDeposit || 0,
//         totalWithdraw: totalWithdrawRes[0]?.totalWithdraw || 0,
//         gamesPlayed,
//         gamesWon,
//         totalBet: totalBetRes[0]?.totalBet || 0,
//         totalWin: totalWinRes[0]?.totalWin || 0,
//       };
//     });

//     const enrichedUserData = await Promise.all(userDataPromises);
//     const totalUsers = await User.countDocuments(userQuery).exec();

//     // 7. Return Final Payload
//     return NextResponse.json(
//       {
//         users: enrichedUserData,
//         totalUsers,
//         totalPages: Math.ceil(totalUsers / limit),
//         currentPage: page,
//       },
//       { status: 200 }
//     );

//   } catch (error: any) {
//     console.error('[Get Users List API Error]:', error.message);
//     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
//   }
// }