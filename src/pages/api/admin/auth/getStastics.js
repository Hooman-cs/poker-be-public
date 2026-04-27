import { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import User from '../../../../models/user'; // Adjust according to your actual model path
import BankTransaction from '../../../../models/bankTransaction';
import PokerGameArchive from '../../../../models/pokerGameArchive';
import dbConnect from '../../../../config/dbConnect';
// Connect to MongoDB
import cookie from 'cookie';

// Aggregate all statistics
// const getStatistics = async () => {
//   await dbConnect();

//   // 1. User Statistics
//   const totalUsers = await User.countDocuments();
//   const activeUsers = await User.countDocuments({ status: 'active' });
//   const inactiveUsers = await User.countDocuments({ status: 'inactive' });
//   const suspendedUsers = await User.countDocuments({ status: 'suspended' });

//   const topNewUsers = await User.find({}, 'username registrationDate').sort({ registrationDate: -1 }).limit(10);
  
//   const usersRegisteredToday = await User.countDocuments({
//     registrationDate: {
//       $gte: new Date(new Date().setHours(0, 0, 0, 0)),
//       $lt: new Date(new Date().setHours(23, 59, 59, 999)),
//     },
//   });

//   // // 2. Bank Transaction Statistics
//   // const totalDepositSuccessful = await BankTransaction.aggregate([
//   //   { $match: { type: 'deposit', status: 'completed' } },
//   //   { $group: { _id: null, totalDeposit: { $sum: '$amount' } } }
//   // ]);
//   // const totalDepositFailed = await BankTransaction.aggregate([
//   //   { $match: { type: 'deposit', status: 'failed' } },
//   //   { $group: { _id: null, totalDeposit: { $sum: '$amount' } } }
//   // ]);
//   // const totalWithdrawSuccessful = await BankTransaction.aggregate([
//   //   { $match: { type: 'withdraw', status: 'completed' } },
//   //   { $group: { _id: null, totalWithdraw: { $sum: '$amount' } } }
//   // ]);
//   // const totalPendingWithdraw = await BankTransaction.aggregate([
//   //   { $match: { type: 'withdraw', status: 'Pending' } },
//   //   { $group: { _id: null, totalWithdraw: { $sum: '$amount' } } }
//   // ]);
//   // const totalPendingDeposit = await BankTransaction.aggregate([
//   //   { $match: { type: 'deposit', status: 'Pending' } },
//   //   { $group: { _id: null, totalWithdraw: { $sum: '$amount' } } }
//   // ]);
//   // const totalWithdrawFailed = await BankTransaction.aggregate([
//   //   { $match: { type: 'withdraw', status: 'failed' } },
//   //   { $group: { _id: null, totalWithdraw: { $sum: '$amount' } } }
//   // ]);
//   // const todaysDepositSuccessful = await BankTransaction.aggregate([
//   //   { $match: { type: 'deposit', status: 'completed', createdOn: { $gte: new Date(new Date().setHours(0, 0, 0, 0)), $lt: new Date(new Date().setHours(23, 59, 59, 999)) } } },
//   //   { $group: { _id: null, todaysDeposit: { $sum: '$amount' } } }
//   // ]);
//   // const todaysWithdrawSuccessful = await BankTransaction.aggregate([
//   //   { $match: { type: 'withdraw', status: 'completed', createdOn: { $gte: new Date(new Date().setHours(0, 0, 0, 0)), $lt: new Date(new Date().setHours(23, 59, 59, 999)) } } },
//   //   { $group: { _id: null, todaysWithdraw: { $sum: '$amount' } } }
//   // ]);
//   // const todaysDepositFailed = await BankTransaction.aggregate([
//   //   { $match: { type: 'deposit', status: 'failed', createdOn: { $gte: new Date(new Date().setHours(0, 0, 0, 0)), $lt: new Date(new Date().setHours(23, 59, 59, 999)) } } },
//   //   { $group: { _id: null, todaysDeposit: { $sum: '$amount' } } }
//   // ]);
//   // const todaysWithdrawFailed = await BankTransaction.aggregate([
//   //   { $match: { type: 'withdraw', status: 'failed', createdOn: { $gte: new Date(new Date().setHours(0, 0, 0, 0)), $lt: new Date(new Date().setHours(23, 59, 59, 999)) } } },
//   //   { $group: { _id: null, todaysWithdraw: { $sum: '$amount' } } }
//   // ]);

//   // 3. Poker Game Archive Statistics



//   const bankTransactionStats = await BankTransaction.aggregate([
//     {
//       $match: {
//         $or: [
//           { createdOn: { $gte: new Date(new Date().setHours(0, 0, 0, 0)), $lt: new Date(new Date().setHours(23, 59, 59, 999)) } },
//           {}
//         ],
//         type: { $in: ['deposit', 'withdraw'] },
//         status: { $in: ['completed', 'failed', 'Pending'] }
//       }
//     },
//     {
//       $group: {
//         _id: {
//           type: '$type',
//           status: '$status',
//           isToday: {
//             $cond: [
//               {
//                 $and: [
//                   { $gte: ['$createdOn', new Date(new Date().setHours(0, 0, 0, 0))] },
//                   { $lt: ['$createdOn', new Date(new Date().setHours(23, 59, 59, 999))] }
//                 ]
//               },
//               true,
//               false
//             ]
//           }
//         },
//         totalAmount: { $sum: '$amount' }
//       }
//     }
//   ]);
  
//   // Initialize variables with default values
//   let totalDepositSuccessful = 0;
//   let totalDepositFailed = 0;
//   let totalWithdrawSuccessful = 0;
//   let totalWithdrawFailed = 0;
//   let totalPendingWithdraw = 0;
//   let totalPendingDeposit = 0;
//   let todaysDepositSuccessful = 0;
//   let todaysDepositFailed = 0;
//   let todaysWithdrawSuccessful = 0;
//   let todaysWithdrawFailed = 0;
  
//   // Process the results
//   bankTransactionStats.forEach((stat) => {
//     const { type, status, isToday } = stat._id;
//     if (type === 'deposit' && status === 'completed' && !isToday) totalDepositSuccessful = stat.totalAmount;
//     if (type === 'deposit' && status === 'failed' && !isToday) totalDepositFailed = stat.totalAmount;
//     if (type === 'deposit' && status === 'Pending') totalPendingDeposit = stat.totalAmount;
//     if (type === 'withdraw' && status === 'completed' && !isToday) totalWithdrawSuccessful = stat.totalAmount;
//     if (type === 'withdraw' && status === 'failed' && !isToday) totalWithdrawFailed = stat.totalAmount;
//     if (type === 'withdraw' && status === 'Pending') totalPendingWithdraw = stat.totalAmount;
  
//     // Today's statistics
//     if (isToday) {
//       if (type === 'deposit' && status === 'completed') todaysDepositSuccessful = stat.totalAmount;
//       if (type === 'deposit' && status === 'failed') todaysDepositFailed = stat.totalAmount;
//       if (type === 'withdraw' && status === 'completed') todaysWithdrawSuccessful = stat.totalAmount;
//       if (type === 'withdraw' && status === 'failed') todaysWithdrawFailed = stat.totalAmount;
//     }
//   });

//   const totalFinishedPokerGames = await PokerGameArchive.countDocuments({ status: 'finished' });
//   const totalPotInFinishedGames = await PokerGameArchive.aggregate([
//     { $match: { status: 'finished' } },
//     { $group: { _id: null, totalPot: { $sum: '$totalBet' } } }
//   ]);
//   const mostPlayedPokerDesk = await PokerGameArchive.aggregate([
//     { $group: { _id: '$deskId', count: { $sum: 1 } } },
//     { $sort: { count: -1 } },
//     { $limit: 1 }
//   ]);
//   const topPlayersByTotalBet = await PokerGameArchive.aggregate([
//     { $unwind: '$players' },
//     { $group: { _id: '$players.userId', totalBet: { $sum: '$players.totalBet' } } },
//     { $sort: { totalBet: -1 } },
//     { $limit: 10 }
//   ]);

//   return {
//     topNewUsers,
//     topPlayersByTotalBet,
//     userStats: {
//       totalUsers,
//       activeUsers,
//       inactiveUsers,
//       suspendedUsers,
//       usersRegisteredToday
//     },
//     bankTransactionStats: {
//       totalDepositSuccessful: totalDepositSuccessful[0]?.totalDeposit || 0,
//       totalDepositFailed: totalDepositFailed[0]?.totalDeposit || 0,
//       totalWithdrawSuccessful: totalWithdrawSuccessful[0]?.totalWithdraw || 0,
//       totalWithdrawFailed: totalWithdrawFailed[0]?.totalWithdraw || 0,
//       todaysDepositSuccessful: todaysDepositSuccessful[0]?.todaysDeposit || 0,
//       todaysWithdrawSuccessful: todaysWithdrawSuccessful[0]?.todaysWithdraw || 0,
//       todaysDepositFailed: todaysDepositFailed[0]?.todaysDeposit || 0,
//       todaysWithdrawFailed: todaysWithdrawFailed[0]?.todaysWithdraw || 0
//     },
//     pokerGameStats: {
//       totalFinishedPokerGames,
//       totalPotInFinishedGames: totalPotInFinishedGames[0]?.totalPot || 0,
//       mostPlayedPokerDesk: mostPlayedPokerDesk[0]?._id || null,
//     }
//   };
// };


// const getStatistics = async () => {
//   await dbConnect();

//   // 1. User Statistics
//   const totalUsers = await User.countDocuments();
//   const activeUsers = await User.countDocuments({ status: 'active' });
//   const inactiveUsers = await User.countDocuments({ status: 'inactive' });
//   const suspendedUsers = await User.countDocuments({ status: 'suspended' });
//   const totalGamesPlayed = await User.aggregate([{ $group: { _id: null, total: { $sum: '$gamesPlayed' } } }]);
//   const totalGamesWon = await User.aggregate([{ $group: { _id: null, total: { $sum: '$gamesWon' } } }]);
//   const totalWinnings = await User.aggregate([{ $group: { _id: null, total: { $sum: '$totalWinnings' } } }]);
//   const usersRegisteredToday = await User.countDocuments({
//     registrationDate: {
//       $gte: new Date(new Date().setHours(0, 0, 0, 0)),
//       $lt: new Date(new Date().setHours(23, 59, 59, 999)),
//     },
//   });

//   const topNewUsers = await User.find({}, 'username registrationDate')
//     .sort({ registrationDate: -1 })
//     .limit(10);

//   // 2. Bank Transaction Statistics
//   const totalDepositSuccessful = await BankTransaction.aggregate([
//     { $match: { type: 'deposit', status: 'completed' } },
//     { $group: { _id: null, totalDeposit: { $sum: '$amount' } } }
//   ]);
//   const totalWithdrawSuccessful = await BankTransaction.aggregate([
//     { $match: { type: 'withdraw', status: 'completed' } },
//     { $group: { _id: null, totalWithdraw: { $sum: '$amount' } } }
//   ]);

//   // 3. Poker Game Archive Statistics
//   const totalActivePokerGames = await PokerGameArchive.countDocuments({ status: 'in-progress', mode: 'cash' });
//   const totalFinishedPokerGames = await PokerGameArchive.countDocuments({ status: 'finished', mode: 'cash' });
//   const totalPotInActiveGames = await PokerGameArchive.aggregate([
//     { $match: { status: 'in-progress', mode: 'cash' } },
//     { $group: { _id: null, totalPot: { $sum: '$totalBet' } } }
//   ]);
//   const totalPotInFinishedGames = await PokerGameArchive.aggregate([
//     { $match: { status: 'finished', mode: 'cash' } },
//     { $group: { _id: null, totalPot: { $sum: '$totalBet' } } }
//   ]);
//   const topPlayersByTotalBet = await PokerGameArchive.aggregate([
//     { $match: { mode: 'cash' } },
//     { $unwind: '$players' },
//     { $group: { _id: '$players.userId', totalBet: { $sum: '$players.totalBet' } } },
//     { $sort: { totalBet: -1 } },
//     { $limit: 10 }
//   ]);

//   return {
//     userStats: {
//       totalUsers,
//       activeUsers,
//       inactiveUsers,
//       suspendedUsers,
//       totalGamesPlayed: totalGamesPlayed[0]?.total || 0,
//       totalGamesWon: totalGamesWon[0]?.total || 0,
//       totalWinnings: totalWinnings[0]?.total || 0,
//       usersRegisteredToday,
//       topNewUsers
//     },
//     bankTransactionStats: {
//       totalDepositSuccessful: totalDepositSuccessful[0]?.totalDeposit || 0,
//       totalWithdrawSuccessful: totalWithdrawSuccessful[0]?.totalWithdraw || 0
//     },
//     pokerGameStats: {
//       totalActivePokerGames,
//       totalFinishedPokerGames,
//       totalPotInActiveGames: totalPotInActiveGames[0]?.totalPot || 0,
//       totalPotInFinishedGames: totalPotInFinishedGames[0]?.totalPot || 0,
//       topPlayersByTotalBet
//     }
//   };
// };


// API handler

// const getStatistics = async () => {
//   await dbConnect();

//   // Combine user statistics into fewer queries
//   const userStatsPipeline = [
//     {
//       $facet: {
//         totalUsers: [{ $count: "count" }],
//         statusCounts: [
//           { $group: { _id: "$status", count: { $sum: 1 } } }
//         ],
//         usersRegisteredToday: [
//           {
//             $match: {
//               registrationDate: {
//                 $gte: new Date(new Date().setHours(0, 0, 0, 0)),
//                 $lt: new Date(new Date().setHours(23, 59, 59, 999)),
//               }
//             }
//           },
//           { $count: "count" }
//         ]
//       }
//     }
//   ];

//   const userStats = await User.aggregate(userStatsPipeline);
//   const totalUsers = userStats[0]?.totalUsers[0]?.count || 0;
//   const statusCounts = userStats[0]?.statusCounts || [];
//   const activeUsers = statusCounts.find((s) => s._id === "active")?.count || 0;
//   const inactiveUsers = statusCounts.find((s) => s._id === "inactive")?.count || 0;
//   const suspendedUsers = statusCounts.find((s) => s._id === "suspended")?.count || 0;
//   const usersRegisteredToday = userStats[0]?.usersRegisteredToday[0]?.count || 0;

//   const topNewUsers = await User.find({}, "username registrationDate")
//     .sort({ registrationDate: -1 })
//     .limit(10);

//   // Bank transaction statistics in a single query
//   const bankTransactionStatsPipeline = [
//     {
//       $facet: {
//         overallStats: [
//           {
//             $match: {
//               type: { $in: ["deposit", "withdraw"] },
//               status: { $in: ["completed", "failed", "Pending"] },
//             },
//           },
//           {
//             $group: {
//               _id: { type: "$type", status: "$status" },
//               totalAmount: { $sum: "$amount" },
//             },
//           },
//         ],
//         todayStats: [
//           {
//             $match: {
//               createdOn: {
//                 $gte: new Date(new Date().setHours(0, 0, 0, 0)),
//                 $lt: new Date(new Date().setHours(23, 59, 59, 999)),
//               },
//             },
//           },
//           {
//             $group: {
//               _id: { type: "$type", status: "$status" },
//               totalAmount: { $sum: "$amount" },
//             },
//           },
//         ],
//       }
//     }
//   ];

//   const bankTransactionStats = await BankTransaction.aggregate(bankTransactionStatsPipeline);

//   const processTransactionStats = (stats) => {
//     const result = {
//       totalDepositSuccessful: 0,
//       totalDepositFailed: 0,
//       totalWithdrawSuccessful: 0,
//       totalWithdrawFailed: 0,
//       totalPendingWithdraw: 0,
//       totalPendingDeposit: 0,
//       todaysDepositSuccessful: 0,
//       todaysDepositFailed: 0,
//       todaysWithdrawSuccessful: 0,
//       todaysWithdrawFailed: 0,
//     };
//     stats.forEach(({ _id, totalAmount }) => {
//       const { type, status } = _id;
//       const key = `${type}${status.charAt(0).toUpperCase() + status.slice(1)}`;
//       if (result[key] !== undefined) {
//         result[key] += totalAmount;
//       }
//     });
//     return result;
//   };

//   const overallBankStats = processTransactionStats(bankTransactionStats[0]?.overallStats || []);
//   const todayBankStats = processTransactionStats(bankTransactionStats[0]?.todayStats || []);

//   // Poker game archive statistics
//   const pokerGameStatsPipeline = [
//     {
//       $facet: {
//         totalFinishedGames: [
//           { $match: { status: "finished" } },
//           { $count: "count" },
//         ],
//         totalPot: [
//           { $match: { status: "finished" } },
//           { $group: { _id: null, totalPot: { $sum: "$totalBet" } } },
//         ],
//         mostPlayedPokerDesk: [
//           { $group: { _id: "$deskId", count: { $sum: 1 } } },
//           { $sort: { count: -1 } },
//           { $limit: 1 },
//         ],
//         topPlayersByTotalBet: [
//           { $unwind: "$players" },
//           {
//             $group: {
//               _id: "$players.userId",
//               totalBet: { $sum: "$players.totalBet" },
//             },
//           },
//           { $sort: { totalBet: -1 } },
//           { $limit: 10 },
//         ],
//       }
//     }
//   ];

//   const pokerGameStats = await PokerGameArchive.aggregate(pokerGameStatsPipeline);

//   const totalFinishedPokerGames = pokerGameStats[0]?.totalFinishedGames[0]?.count || 0;
//   const totalPotInFinishedGames = pokerGameStats[0]?.totalPot[0]?.totalPot || 0;
//   const mostPlayedPokerDesk = pokerGameStats[0]?.mostPlayedPokerDesk[0]?._id || null;
//   const topPlayersByTotalBet = pokerGameStats[0]?.topPlayersByTotalBet || [];

//   return {
//     topNewUsers,
//     topPlayersByTotalBet,
//     userStats: {
//       totalUsers,
//       activeUsers,
//       inactiveUsers,
//       suspendedUsers,
//       usersRegisteredToday,
//     },
//     bankTransactionStats: {
//       ...overallBankStats,
//       ...todayBankStats,
//     },
//     pokerGameStats: {
//       totalFinishedPokerGames,
//       totalPotInFinishedGames,
//       mostPlayedPokerDesk,
//     },
//   };
// };



const getStatistics = async () => {
  await dbConnect();

  // 1. User Statistics
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ status: 'active' });
  const inactiveUsers = await User.countDocuments({ status: 'inactive' });
  const suspendedUsers = await User.countDocuments({ status: 'suspended' });

  const topNewUsers = await User.find({}, 'username registrationDate')
      .sort({ registrationDate: -1 })
      .limit(10);

  const usersRegisteredToday = await User.countDocuments({
      registrationDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
  });

  // User Device Type Statistics
  const deviceTypeStats = await User.aggregate([
      { $group: { _id: '$deviceType', count: { $sum: 1 } } }
  ]);

  // 2. Bank Transaction Statistics
  const bankTransactionStats = await BankTransaction.aggregate([
      {
          $match: {
              type: { $in: ['deposit', 'withdraw'] },
              status: { $in: ['completed', 'failed', 'Pending'] },
          },
      },
      {
          $group: {
              _id: {
                  type: '$type',
                  status: '$status',
                  isToday: {
                      $cond: [
                          {
                              $and: [
                                  { $gte: ['$createdOn', new Date(new Date().setHours(0, 0, 0, 0))] },
                                  { $lt: ['$createdOn', new Date(new Date().setHours(23, 59, 59, 999))] },
                              ],
                          },
                          true,
                          false,
                      ],
                  },
              },
              totalAmount: { $sum: '$amount' },
          },
      },
  ]);

  let bankStats = {
      totalDepositSuccessful: 0,
      totalDepositFailed: 0,
      totalWithdrawSuccessful: 0,
      totalWithdrawFailed: 0,
      totalPendingWithdraw: 0,
      totalPendingDeposit: 0,
      todaysDepositSuccessful: 0,
      todaysDepositFailed: 0,
      todaysWithdrawSuccessful: 0,
      todaysWithdrawFailed: 0,
  };

  bankTransactionStats.forEach((stat) => {
      const { type, status, isToday } = stat._id;

      // Aggregate general stats
      if (type === 'deposit' && status === 'completed' && !isToday) bankStats.totalDepositSuccessful = stat.totalAmount;
      if (type === 'deposit' && status === 'failed' && !isToday) bankStats.totalDepositFailed = stat.totalAmount;
      if (type === 'deposit' && status === 'Pending') bankStats.totalPendingDeposit = stat.totalAmount;
      if (type === 'withdraw' && status === 'completed' && !isToday) bankStats.totalWithdrawSuccessful = stat.totalAmount;
      if (type === 'withdraw' && status === 'failed' && !isToday) bankStats.totalWithdrawFailed = stat.totalAmount;
      if (type === 'withdraw' && status === 'Pending') bankStats.totalPendingWithdraw = stat.totalAmount;

      // Aggregate today's stats
      if (isToday) {
          if (type === 'deposit' && status === 'completed') bankStats.todaysDepositSuccessful = stat.totalAmount;
          if (type === 'deposit' && status === 'failed') bankStats.todaysDepositFailed = stat.totalAmount;
          if (type === 'withdraw' && status === 'completed') bankStats.todaysWithdrawSuccessful = stat.totalAmount;
          if (type === 'withdraw' && status === 'failed') bankStats.todaysWithdrawFailed = stat.totalAmount;
      }
  });

  // 3. Poker Game Statistics (Cash-Mode Only)
  // const pokerGameStats = await PokerGameArchive.aggregate([
  //     { $match: { mode: 'cash' } },
  //     {
  //         $facet: {
  //             totalFinishedGames: [
  //                 { $match: { status: 'finished' } },
  //                 { $count: 'total' },
  //             ],
  //             totalPotInFinishedGames: [
  //                 { $match: { status: 'finished' } },
  //                 { $group: { _id: null, totalPot: { $sum: '$totalBet' } } },
  //             ],
  //             mostPlayedPokerDesk: [
  //                 { $group: { _id: '$deskId', count: { $sum: 1 } } },
  //                 { $sort: { count: -1 } },
  //                 { $limit: 1 },
  //             ],
  //             topPlayersByTotalBet: [
  //                 { $unwind: '$players' },
  //                 { $group: { _id: '$players.userId', totalBet: { $sum: '$players.totalBet' } } },
  //                 { $sort: { totalBet: -1 } },
  //                 { $limit: 10 },
  //             ],
  //         },
  //     },
  // ]);

  const pokerGameStats = await PokerGameArchive.aggregate([
    { $match: { mode: 'cash' } },
    {
      $facet: {
        totalFinishedGames: [
          { $match: { status: 'finished' } },
          { $count: 'total' },
        ],
        totalPotInFinishedGames: [
          { $match: { status: 'finished' } },
          { $group: { _id: null, totalPot: { $sum: '$totalBet' } } },
        ],
        mostPlayedPokerDesk: [
          { $group: { _id: '$deskId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 },
        ],
        topPlayersByTotalBet: [
          { $unwind: '$players' },
          {
            $group: {
              _id: '$players.userId',
              totalBet: { $sum: '$players.totalBet' },
            },
          },
          { $sort: { totalBet: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'users', // Collection name of the Users table
              localField: '_id', // Field from the current collection
              foreignField: '_id', // Field in the Users collection
              as: 'userDetails',
            },
          },
          {
            $project: {
              _id: 1,
              totalBet: 1,
              username: { $arrayElemAt: ['$userDetails.username', 0] },
            },
          },
        ],
      },
    },
  ]);
  
  const pokerStatsResult = pokerGameStats[0] || {};
  const totalFinishedGames = pokerStatsResult.totalFinishedGames?.[0]?.total || 0;
  const totalPotInFinishedGames = pokerStatsResult.totalPotInFinishedGames?.[0]?.totalPot || 0;
  const mostPlayedPokerDesk = pokerStatsResult.mostPlayedPokerDesk?.[0]?._id || null;
  const topPlayersByTotalBet = pokerStatsResult.topPlayersByTotalBet || [];

  // Compile the results
  return {
      userStats: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          suspendedUsers,
          usersRegisteredToday,
          deviceTypeStats,
          topNewUsers,
      },
      bankTransactionStats: bankStats,
      pokerGameStats: {
          totalFinishedGames,
          totalPotInFinishedGames,
          mostPlayedPokerDesk,
          topPlayersByTotalBet,
      },
  };
};


export default async function handler(req, res) {
  if (req.method === 'GET') {

    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token;
      
    if (!token) {
        return res.status(401).json({ message: 'Authentication token is missing or invalid' });
    }
    try {
      const stats = await getStatistics();
      return res.status(200).json({ success: true, data: stats });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  } else {
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
}
