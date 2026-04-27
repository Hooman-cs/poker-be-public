import dbConnect from '../../../../config/dbConnect';
import PokerGameArchive from '../../../../models/pokerGameArchive';
import User from '../../../../models/user';
import { verifyToken } from '../../../../utils/jwt';
import cookie from 'cookie';

export default async function handler(req, res) {
    await dbConnect();

    const { userId, username } = req.query;
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

        // Retrieve user by either userId or username
        const user = await User.findOne(userId ? { _id: userId } : { username });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Match stage to find user-specific data
        const matchStage = { "players.userId": user._id };

        // Aggregation pipeline to compute user stats
        const userStatsPipeline = [
            { $match: matchStage },
            { $unwind: "$pots" },
            { $unwind: "$pots.winners" },
            { $match: { "pots.winners.playerId": user._id } },
            {
                $group: {
                    _id: "$pots.winners.playerId",
                    totalWins: { $sum: "$pots.winners.amount" },
                    totalBet: { $sum: "$players.totalBet" },
                    gamesPlayed: { $sum: 1 },
                    totalContributions: { $sum: "$pots.contributors.contribution" },
                    totalFolds: { $sum: { $cond: [{ $eq: ["$players.status", "folded"] }, 1, 0] } },
                    totalRaises: { $sum: { $cond: [{ $eq: ["$players.actions.action", "raise"] }, 1, 0] } },
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
            {
                $project: {
                    userId: "$user._id",
                    username: "$user.username",
                    totalWins: 1,
                    totalBet: 1,
                    gamesPlayed: 1,
                    totalContributions: 1,
                    totalFolds: 1,
                    totalRaises: 1,
                    winRate: { $divide: ["$totalWins", "$gamesPlayed"] },
                    betToWinRatio: { $divide: ["$totalBet", "$totalWins"] },
                    foldRate: { $divide: ["$totalFolds", "$gamesPlayed"] }
                }
            }
        ];

        const [userStatsResult] = await PokerGameArchive.aggregate(userStatsPipeline);
        const userStats = userStatsResult || {
            totalBet: 0, 
            totalWins: 0, 
            gamesPlayed: 0, 
            totalContributions: 0, 
            totalFolds: 0, 
            totalRaises: 0,
            winRate: 0,
            betToWinRatio: 0,
            foldRate: 0
        };

        res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                username: user.username,
                totalWins: userStats.totalWins,
                totalBet: userStats.totalBet,
                gamesPlayed: userStats.gamesPlayed,
                totalContributions: userStats.totalContributions,
                winRate: userStats.winRate,
                betToWinRatio: userStats.betToWinRatio,
                foldRate: userStats.foldRate
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
}
