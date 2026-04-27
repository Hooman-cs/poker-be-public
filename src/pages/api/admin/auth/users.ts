
import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../config/dbConnect';
import User from '../../../../models/user';
import PokerGameArchive from '../../../../models/pokerGameArchive';
import { verifyToken } from '../../../../utils/jwt';
import cookie from 'cookie';
 
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is missing or invalid' });
  }

  try {
    const payload: any = await verifyToken(token);

    if (!payload.userId || payload.role !== 'superadmin') {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    const { page = 1, limit = 10, status, startDate, endDate, searchName } = req.query;

    const defaultStartDate = new Date('2000-01-01');
    const defaultEndDate = new Date();

    const finalStartDate = startDate ? new Date(startDate as string) : defaultStartDate;
    const finalEndDate = endDate ? new Date(endDate as string) : defaultEndDate;

    const userQuery: any = {};
    if (status) userQuery.status = status;

    if (searchName) {
      userQuery.username = new RegExp(`^${searchName}`, 'i'); // Case-insensitive match
    }

    const users = await User.find(userQuery)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const userDataPromises = users.map(async (user) => {
      const totalDeposit = user.wallet.transactions
        .filter((txn: any) => ['deposit', 'pgDeposit'].includes(txn.type))
        .reduce((total: number, txn: any) => total + txn.amount.total, 0);

      const totalWithdraw = user.wallet.transactions
        .filter((txn: any) => txn.type === 'withdraw')
        .reduce((total: number, txn: any) => total + txn.amount.total, 0);

      // const gamesPlayed = await PokerGameArchive.countDocuments({
      //   'players.userId': user._id,
      //   createdAt: { $gte: finalStartDate, $lte: finalEndDate },
      // });

      // const gamesWon = await PokerGameArchive.countDocuments({
      //   'players.userId': user._id,
      //   'pots.winners.playerId': user._id,
      //   createdAt: { $gte: finalStartDate, $lte: finalEndDate },
      // });

      // const totalBet = await PokerGameArchive.aggregate([
      //   { $match: { 'players.userId': user._id, createdAt: { $gte: finalStartDate, $lte: finalEndDate } } },
      //   { $unwind: '$players' },
      //   { $match: { 'players.userId': user._id } },
      //   { $group: { _id: null, totalBet: { $sum: '$players.totalBet' } } },
      // ]);

      // const totalWin = await PokerGameArchive.aggregate([
      //   { $match: { createdAt: { $gte: finalStartDate, $lte: finalEndDate }, 'pots.winners.playerId': user._id } },
      //   { $unwind: '$pots.winners' },
      //   { $match: { 'pots.winners.playerId': user._id } },
      //   { $group: { _id: null, totalWin: { $sum: '$pots.winners.amount' } } },
      // ]);


      const totalBet = await PokerGameArchive.aggregate([
        { $match: { 'players.userId': user._id } },
        { $unwind: '$players' },
        { $match: { 'players.userId': user._id } },
        { $group: { _id: null, totalBet: { $sum: '$players.totalBet' } } },
      ]);
      
      
   const totalWin = await PokerGameArchive.aggregate([
    { $unwind: '$pots' }, // Unwind pots array
    { $unwind: '$pots.winners' }, // Unwind winners array
    { $match: { 'pots.winners.playerId': user._id } }, // Match user ID
    { $group: { _id: null, totalWin: { $sum: '$pots.winners.amount' } } }, // Sum winnings
  ]);


      const gamesPlayed = await PokerGameArchive.countDocuments({
        'players.userId': user._id,
      });
      
      const gamesWon = await PokerGameArchive.countDocuments({
        'players.userId': user._id,
        'pots.winners.playerId': user._id,
      });
      

      return {
        _id: user._id,
        username: user.username, // Format username to two decimal points
        status: user.status,
        mobileNumber: user.mobileNumber,
        walletBalance: parseFloat(user.wallet.balance.toFixed(2)),
        totalDeposit,
        totalWithdraw,
        gamesPlayed,
        gamesWon,
        totalBet: totalBet[0]?.totalBet || 0,
        totalWin: totalWin[0]?.totalWin || 0,
      };
    });

    const userData = await Promise.all(userDataPromises);

    const totalUsers = await User.countDocuments(userQuery);

    res.status(200).json({
      users: userData,
      totalUsers,
      currentPage: Number(page),
      totalPages: Math.ceil(totalUsers / Number(limit)),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
