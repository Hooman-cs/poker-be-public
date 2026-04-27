import dbConnect from '../../../../config/dbConnect';
import PokerGameArchive from '../../../../models/pokerGameArchive';
import PokerDesk from '../../../../models/pokerDesk';
import { verifyToken } from '../../../../utils/jwt';
import cookie from 'cookie';

export default async function handler(req, res) {
    await dbConnect();

    const { deskId, pokerModeId, startDate, endDate } = req.query;
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Authentication token is missing or invalid' });
    }

    try {
        const payload = verifyToken(token);
        if (!payload.userId || payload.role !== 'superadmin') {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        const matchStage = {};
        if (deskId) matchStage.deskId = deskId;

        if (pokerModeId) {
            const pokerDesks = await PokerDesk.find({ pokerModeId }).select('_id');
            const deskIds = pokerDesks.map(desk => desk._id);
            matchStage.deskId = { $in: deskIds };
        }

        if (startDate || endDate) {
            const dateFilter = {};
            if (startDate) dateFilter.$gte = new Date(startDate);
            if (endDate) dateFilter.$lte = new Date(endDate);
            matchStage.createdAt = dateFilter;
        }

        // Overall Stats: Total games and total bet sum
        const overallStatsPipeline = [
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalGames: { $sum: 1 },
                    totalBet: { $sum: "$totalBet" }
                }
            }
        ];

        const [overallStats = { totalGames: 0, totalBet: 0 }] = await PokerGameArchive.aggregate(overallStatsPipeline);

        // Top Winners: Calculate totalWinAmount from pots.winners.amount and totalBet from players.totalBet
        const topWinnersPipeline = [
            { $match: matchStage },
            { $unwind: "$pots" },
            { $unwind: "$pots.winners" },
            {
                $group: {
                    _id: "$pots.winners.playerId",
                    totalWinAmount: { $sum: "$pots.winners.amount" },
                    totalBet: { $sum: { $sum: "$players.totalBet" } }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            { $sort: { totalWinAmount: -1 } },
            { $limit: 10 },
            {
                $project: {
                    userId: "$user._id",
                    username: "$user.username",
                    totalWinAmount: 1,
                    totalBet: 1
                }
            }
        ];
        const topWinners = await PokerGameArchive.aggregate(topWinnersPipeline);

        // Top Contributors: Calculate totalContributed from pots.contributors.contribution and totalBet from players.totalBet
        const topContributorsPipeline = [
            { $match: matchStage },
            { $unwind: "$pots" },
            { $unwind: "$pots.contributors" },
            {
                $group: {
                    _id: "$pots.contributors.playerId",
                    totalContributed: { $sum: "$pots.contributors.contribution" },
                    totalBet: { $sum: { $sum: "$players.totalBet" } }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            { $sort: { totalContributed: -1 } },
            { $limit: 10 },
            {
                $project: {
                    userId: "$user._id",
                    username: "$user.username",
                    totalContributed: 1,
                    totalBet: 1
                }
            }
        ];
        const topContributors = await PokerGameArchive.aggregate(topContributorsPipeline);

        res.status(200).json({
            success: true,
            data: {
                totalGames: overallStats.totalGames,
                totalBet: overallStats.totalBet,
                topWinners,
                topContributors
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
}





// import dbConnect from '../../../../config/dbConnect';
// import PokerGameArchive from '../../../../models/pokerGameArchive';
// import PokerDesk from '../../../../models/pokerDesk';
// import { verifyToken } from '../../../../utils/jwt';
// import cookie from 'cookie';

// export default async function handler(req, res) {
//     await dbConnect();

//     const { deskId, pokerModeId, startDate, endDate } = req.query;
//     const cookies = cookie.parse(req.headers.cookie || '');
//     const token = cookies.token;

//     if (!token) {
//         return res.status(401).json({ message: 'Authentication token is missing or invalid' });
//     }

//     try {
//         const payload = verifyToken(token);
//         if (!payload.userId || payload.role !== 'superadmin') {
//             return res.status(403).json({ message: 'Unauthorized access' });
//         }

//         // Prepare the match conditions based on the filters
//         const matchStage = {};

//         if (deskId) matchStage.deskId = deskId;

//         if (pokerModeId) {
//             const pokerDesks = await PokerDesk.find({ pokerModeId }).select('_id');
//             const deskIds = pokerDesks.map(desk => desk._id);
//             matchStage.deskId = { $in: deskIds };
//         }

//         if (startDate || endDate) {
//             const dateFilter = {};
//             if (startDate) dateFilter.$gte = new Date(startDate);
//             if (endDate) dateFilter.$lte = new Date(endDate);
//             matchStage.createdAt = dateFilter;
//         }

//         // Overall Stats
//         const overallStatsPipeline = [
//             { $match: matchStage },
//             {
//                 $group: {
//                     _id: null,
//                     totalGames: { $sum: 1 },
//                     totalBet: { $sum: "$pot" }
//                 }
//             }
//         ];
//         const [overallStats] = await PokerGameArchive.aggregate(overallStatsPipeline) || [{ totalGames: 0, totalBet: 0 }];
        
//         // Top Winners
//         const topWinnersPipeline = [
//             { $match: matchStage },
//             { $unwind: "$pots" },
//             { $unwind: "$pots.winners" },
//             {
//                 $group: {
//                     _id: "$pots.winners.playerId",
//                     totalWinAmount: { $sum: "$pots.winners.amount" },
//                     totalBet: { $sum: "$players.totalBet" } // Adjust according to your data
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "users",
//                     localField: "_id",
//                     foreignField: "_id",
//                     as: "user"
//                 }
//             },
//             { $unwind: "$user" },
//             { $sort: { totalWinAmount: -1 } },
//             { $limit: 10 },
//             {
//                 $project: {
//                     userId: "$user._id",
//                     username: "$user.username",
//                     totalWinAmount: 1,
//                     totalBet: 1
//                 }
//             }
//         ];
//         const topWinners = await PokerGameArchive.aggregate(topWinnersPipeline);

//         // Win Rate
//         const winRatePipeline = [
//             { $match: matchStage },
//             { $unwind: "$pots" },
//             { $unwind: "$pots.winners" },
//             { $group: {
//                 _id: "$pots.winners.playerId",
//                 totalWins: { $sum: 1 }, // Count of wins
//                 totalGames: { $sum: 1 }  // Count of games played
//             }},
//             { $project: {
//                 winRate: { $divide: ["$totalWins", "$totalGames"] }
//             }},
//             { $sort: { winRate: -1 } },
//             { $limit: 10 },
//             {
//                 $project: {
//                     userId: "$_id",
//                     winRate: 1
//                 }
//             }
//         ];
//         const winRate = await PokerGameArchive.aggregate(winRatePipeline);

//         // Average Bet and Win Amount per Game
//         const avgBetAndWinPipeline = [
//             { $match: matchStage },
//             { $unwind: "$pots" },
//             { $unwind: "$pots.winners" },
//             { $group: {
//                 _id: "$pots.winners.playerId",
//                 totalBet: { $sum: "$players.totalBet" },
//                 totalWinAmount: { $sum: "$pots.winners.amount" },
//                 gamesPlayed: { $sum: 1 }
//             }},
//             { $project: {
//                 avgBet: { $divide: ["$totalBet", "$gamesPlayed"] },
//                 avgWinAmount: { $divide: ["$totalWinAmount", "$gamesPlayed"] }
//             }},
//             { $sort: { avgWinAmount: -1 } },
//             { $limit: 10 },
//             {
//                 $project: {
//                     userId: "$_id",
//                     avgBet: 1,
//                     avgWinAmount: 1
//                 }
//             }
//         ];
//         const avgBetAndWin = await PokerGameArchive.aggregate(avgBetAndWinPipeline);

//         // Top Contributors
//         const topContributorsPipeline = [
//             { $match: matchStage },
//             { $unwind: "$pots" },
//             { $unwind: "$pots.contributors" },
//             { $group: {
//                 _id: "$pots.contributors.playerId",
//                 totalContributed: { $sum: "$pots.contributors.contribution" },
//                 totalBet: { $sum: "$players.totalBet" }
//             }},
//             { $sort: { totalContributed: -1 } },
//             { $limit: 10 },
//             {
//                 $project: {
//                     userId: "$_id",
//                     totalContributed: 1,
//                     totalBet: 1
//                 }
//             }
//         ];
//         const topContributors = await PokerGameArchive.aggregate(topContributorsPipeline);

//         res.status(200).json({
//             success: true,
//             data: {
//                 totalGames: overallStats.totalGames,
//                 totalBet: overallStats.totalBet,
//                 topWinners,
//                 winRate,
//                 avgBetAndWin,
//                 topContributors
//             }
//         });
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ success: false, error: 'Server Error' });
//     }
// }





// // import dbConnect from '../../../../config/dbConnect';
// // import PokerGameArchive from '../../../../models/pokerGameArchive';
// // import User from '../../../../models/user';
// // import PokerDesk from '../../../../models/pokerDesk';
// // import { verifyToken } from '../../../../utils/jwt';
// // import cookie from 'cookie';

// // export default async function handler(req, res) {
// //     await dbConnect();

// //     const { userId, deskId, pokerModeId, startDate, endDate } = req.query;

// //     const cookies = cookie.parse(req.headers.cookie || '');
// //     const token = cookies.token;
    
// //     console.log('Request Query:', req.query);

// //     if (!token) {
// //         return res.status(401).json({ message: 'Authentication token is missing or invalid' });
// //     }

// //     try {
// //         const payload = verifyToken(token);
// //         if (!payload.userId || payload.role !== 'superadmin') {
// //             return res.status(403).json({ message: 'Unauthorized access' });
// //         }

// //         console.log('User Authenticated:', payload);

// //         // Prepare the match conditions
// //         const matchStage = {};

// //         if (userId) {
// //             matchStage['players.userId'] = userId;
// //             console.log('Filtering by userId:', userId);
// //         }

// //         if (deskId) {
// //             matchStage.deskId = deskId;
// //             console.log('Filtering by deskId:', deskId);
// //         }

// //         if (pokerModeId) {
// //             const pokerDesks = await PokerDesk.find({ pokerModeId }).select('_id');
// //             const deskIds = pokerDesks.map(desk => desk._id);
// //             matchStage.deskId = { $in: deskIds };
// //             console.log('Filtering by pokerModeId:', pokerModeId, 'Desk IDs:', deskIds);
// //         }

// //         if (startDate && endDate) {
// //             matchStage.createdOn = {
// //                 $gte: new Date(startDate),
// //                 $lte: new Date(endDate)
// //             };
// //             console.log('Filtering by date range:', startDate, 'to', endDate);
// //         }

// //         console.log('Match Stage:', matchStage);

// //         // MongoDB Aggregation Pipeline
// //         const aggregationPipeline = [
// //             { $match: matchStage },
// //             {
// //                 $lookup: {
// //                     from: 'users',
// //                     localField: 'players.userId',
// //                     foreignField: '_id',
// //                     as: 'players.userInfo'
// //                 }
// //             },
// //             {
// //                 $unwind: '$pots'
// //             },
// //             {
// //                 $unwind: '$pots.winners'
// //             },
// //             {
// //                 $group: {
// //                     _id: null,
// //                     totalGames: { $sum: 1 },
// //                     totalBet: { $sum: '$pot' },
// //                     winners: { $push: { username: '$pots.winners.playerId.username', amount: '$pots.winners.amount' } }
// //                 }
// //             },
// //             {
// //                 $project: {
// //                     totalGames: 1,
// //                     totalBet: 1,
// //                     winners: 1
// //                 }
// //             }
// //         ];

// //         console.log('Aggregation Pipeline:', JSON.stringify(aggregationPipeline, null, 2));

// //         const result = await PokerGameArchive.aggregate(aggregationPipeline);

// //         console.log('Aggregation Result:', result);

// //         // Extract data from the aggregation result
// //         const winners = result[0]?.winners || [];
// //         const totalGames = result[0]?.totalGames || 0;
// //         const totalBet = result[0]?.totalBet || 0;

// //         console.log('Total Games:', totalGames);
// //         console.log('Total Bet:', totalBet);
// //         console.log('Winners:', winners);

// //         // Calculate top 10 winners
// //         const topWinners = winners
// //             .reduce((acc, { username, amount }) => {
// //                 const existing = acc.find(winner => winner.username === username);
// //                 if (existing) {
// //                     existing.amount += amount;
// //                 } else {
// //                     acc.push({ username, amount });
// //                 }
// //                 return acc;
// //             }, [])
// //             .sort((a, b) => b.amount - a.amount)
// //             .slice(0, 10);

// //         console.log('Top Winners:', topWinners);

// //         let userStats = {};
// //         if (userId) {
// //             userStats = winners.reduce((stats, { username, amount }) => {
// //                 if (username === userId) {
// //                     stats.totalWins = amount;
// //                     stats.totalBet = totalBet; // Assuming totalBet is what the user bet in all games
// //                 }
// //                 return stats;
// //             }, { totalBet: 0, totalWins: 0 });

// //             console.log('User Stats:', userStats);
// //         }

// //         // Return the aggregated dashboard data
// //         res.status(200).json({
// //             success: true,
// //             data: {
// //                 totalGames,
// //                 totalBet,
// //                 topWinners,
// //                 userStats
// //             }
// //         });
// //     } catch (error) {
// //         console.error('Error:', error);
// //         res.status(500).json({ success: false, error: 'Server Error' });
// //     }
// // }
