

import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../../config/dbConnect';
import User from '../../../../../models/user';
import PokerGameArchive from '@/models/pokerGameArchive';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    // Fetch user details
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Aggregation: Total Bet
    const totalBetResult = await PokerGameArchive.aggregate([
      { $match: { 'players.userId': user._id } },
      { $unwind: '$players' },
      { $match: { 'players.userId': user._id } },
      { $group: { _id: null, totalBet: { $sum: '$players.totalBet' } } },
    ]);
    const totalBet = totalBetResult[0]?.totalBet || 0;

    // Aggregation: Total Win
    const totalWinResult = await PokerGameArchive.aggregate([
      { $unwind: '$pots' }, // Unwind pots array
      { $unwind: '$pots.winners' }, // Unwind winners array
      { $match: { 'pots.winners.playerId': user._id } }, // Match user ID
      { $group: { _id: null, totalWin: { $sum: '$pots.winners.amount' } } }, // Sum winnings
    ]);
    const totalWin = totalWinResult[0]?.totalWin || 0;

    // Aggregation for wallet transactions
    const walletStats = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      { $unwind: '$wallet.transactions' },
      { $match: { 'wallet.transactions.status': 'completed' } },
      {
        $group: {
          _id: '$_id',
          totalDeposit: {
            $sum: {
              $cond: {
                if: { $in: ['$wallet.transactions.type', ['pgDeposit', 'deposit']] },
                then: '$wallet.transactions.amount.total',
                else: 0,
              },
            },
          },
          totalWithdraw: {
            $sum: {
              $cond: {
                if: { $eq: ['$wallet.transactions.type', 'withdraw'] },
                then: '$wallet.transactions.amount.total',
                else: 0,
              },
            },
          },
          totalDeskIn: {
            $sum: {
              $cond: {
                if: { $eq: ['$wallet.transactions.type', 'deskIn'] },
                then: '$wallet.transactions.amount.total',
                else: 0,
              },
            },
          },
          totalDeskWithdraw: {
            $sum: {
              $cond: {
                if: { $eq: ['$wallet.transactions.type', 'deskWithdraw'] },
                then: '$wallet.transactions.amount.total',
                else: 0,
              },
            },
          },
        },
      },
    ]);

    const walletSummary = walletStats[0] || {
      totalDeposit: 0,
      totalWithdraw: 0,
      totalDeskIn: 0,
      totalDeskWithdraw: 0,
    };

    // Response with aggregated data
    return res.status(200).json({
      userDetails: {
        username: user.username,
        mobileNumber: user.mobileNumber,
        registrationDate: user.registrationDate,
        lastLogin: user.lastLogin,
        isActive: user.isActive,
        status: user.status,
        deviceType: user.deviceType,
        latitude: user.latitude,
        longitude: user.longitude,
      },
      wallet: {
        balance: user.wallet.balance,
        instantBonus: user.wallet.instantBonus,
        lockedBonus: user.wallet.lockedBonus,
      },
      totalBet,
      totalWin,
      ...walletSummary,
    });
  } catch (error: any) {
    console.error('Error fetching user details:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}














// // pages/api/admin/users/[userId]/balance.ts

// import { NextApiRequest, NextApiResponse } from 'next';
// import dbConnect from '../../../../../config/dbConnect';
// import User from '../../../../../models/user';
// import { verifyToken } from '../../../../../utils/jwt';
// import cookie from 'cookie';
// import { IWalletTransaction } from '@/utils/pokerModelTypes';
// import BankTransaction from '@/models/bankTransaction';
// import PokerGameArchive from '@/models/pokerGameArchive';
// import mongoose from 'mongoose';

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   await dbConnect();

//   const cookies = cookie.parse(req.headers.cookie || '');
//   const token = cookies.token;
//   const { userId} = req.body;
//   if (!token) {
//     return res.status(401).json({ message: 'Authentication token is missing or invalid' });
//   }

//   try {
//     // Fetch user data from MongoDB
//     const user = await User.findById(userId).exec();
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // Fetch bank transaction data for the user
//     const bankTransactions = await BankTransaction.find({ userId }).exec();

//     // Fetch game statistics for the user
//     const gameStats = await PokerGameArchive.aggregate([
//       { $unwind: "$players" },
//       { $match: { "players.userId": new mongoose.Types.ObjectId(userId) } },
//       {
//         $group: {
//           _id: "$players.userId",
//           totalBet: { $sum: "$players.totalBet" },
//           totalWinAmount: { $sum: { $sum: "$pots.winners.amount" } }
//         }
//       }
//     ]);

//     const userGameStats = gameStats[0] || { totalBet: 0, totalWinAmount: 0 };

//     // Return all details in a single response
//     return res.status(201).json({
//       user,
//       bankTransactions,
//       userGameStats,
//       walletTransactions: user.wallet.transactions || []
//     });

// } catch (error: any) {
//     console.error('Error updating user balance:', error);
//     return res.status(500).json({ message: 'Internal server error', error: error.message });
//   }
// }
