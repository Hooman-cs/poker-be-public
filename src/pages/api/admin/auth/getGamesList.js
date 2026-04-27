
// import dbConnect from '../../../../config/dbConnect';
// import PokerGameArchive from '../../../../models/pokerGameArchive';
// import User from '../../../../models/user';
// import PokerDesk from '../../../../models/pokerDesk';
// import { parseISO, startOfDay, endOfDay } from 'date-fns';
// import { verifyToken } from '../../../../utils/jwt';
// import cookie from 'cookie';

// export default async function handler(req, res) {
//     await dbConnect();

//     const { 
//         pageNo = 1, 
//         itemsPerPage = 25, 
//         deskId, 
//         username, 
//         startDate = '2021-01-01', 
//         endDate = new Date().toISOString().split('T')[0],
//         sortBy = 'date', 
//         sortOrder = 'desc',
//         pokerModeId 
//     } = req.query;


//     const cookies = cookie.parse(req.headers.cookie || '');
//     const token = cookies.token;
      
//     if (!token) {
//         return res.status(401).json({ message: 'Authentication token is missing or invalid' });
//     }

//     try {
//         const query = {};

//         const payload = verifyToken(token);
//         if (!payload.userId || payload.role !== 'superadmin') {
//           return res.status(403).json({ message: 'Unauthorized access' });
//         }
//         // Filter by pokerModeId if provided
//         if (pokerModeId) {
//             const pokerDesks = await PokerDesk.find({ pokerModeId }).select('_id');
//             const deskIds = pokerDesks.map(desk => desk._id);
//             query.deskId = { $in: deskIds };
//         }

//         // Filter by deskId if provided
//         if (deskId) {
//             query.deskId = deskId;
//         }

//         // Filter by username if provided
//         if (username) {
//             const user = await User.findOne({ username }).select('_id');
//             if (user) {
//                 query['players.userId'] = user._id;
//             } else {
//                 return res.status(200).json({
//                     success: true,
//                     data: [],
//                     pageNo: parseInt(pageNo, 10),
//                     itemsPerPage: parseInt(itemsPerPage, 10),
//                     totalPages: 0,
//                     totalItems: 0
//                 });
//             }
//         }

//         // Filter by date range
//         const start = startOfDay(parseISO(startDate));
//         const end = endOfDay(parseISO(endDate));
//         query.createdAt = { $gte: start, $lte: end };

//         // Define sorting options
//         const sortOptions = sortBy === 'potAmount'
//             ? { totalBet: sortOrder === 'asc' ? 1 : -1 }
//             : { createdAt: sortOrder === 'asc' ? 1 : -1 };

//         // Pagination options
//         const limit = parseInt(itemsPerPage, 10);
//         const skip = (parseInt(pageNo, 10) - 1) * limit;

//         // Fetch data with filters and pagination
//         const pokerGameArchives = await PokerGameArchive.find(query)
//             .sort(sortOptions)
//             .skip(skip)
//             .limit(limit)
//             .populate({
//                 path: 'players.userId',
//                 select: 'username' // Populate only username for players
//             })
//             .populate({
//                 path: 'pots.winners.playerId',
//                 select: 'username' // Populate only username for winners in pots
//             })
//             .select('deskId players pots createdAt pot') // Select only necessary fields
//             .exec();

//         const formattedData = pokerGameArchives.map(archive => ({
//             gameArchiveId: archive._id,
//             tableId: archive.deskId,
//             players: archive.players.map(player => ({
//                 username: player.userId ? player.userId.username : 'DeletedUser',
//                 totalBet: player.totalBet,
//                 status: player.status
//             })),
//             pots: archive.pots.map(pot => ({
//                 winners: pot.winners.map(winner => ({
//                     username: winner.playerId ? winner.playerId.username : 'DeletedUser',
//                     amount: winner.amount
//                 }))
//             })),
//             totalBet : archive.totalBet,
//             createdAt: archive.createdAt
//         }));
       
//         const totalCount = await PokerGameArchive.countDocuments(query);

//         // Send the response
//         res.status(200).json({
//             success: true,
//             data: formattedData,
//             pageNo: parseInt(pageNo, 10),
//             itemsPerPage: limit,
//             totalPages: Math.ceil(totalCount / limit),
//             totalItems: totalCount
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ success: false, error: 'Server Error' });
//     }
// }

 
import dbConnect from '../../../../config/dbConnect';
import PokerGameArchive from '../../../../models/pokerGameArchive';
import User from '../../../../models/user';
import PokerDesk from '../../../../models/pokerDesk';
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { verifyToken } from '../../../../utils/jwt';
import cookie from 'cookie';

export default async function handler(req, res) {
    await dbConnect();

    const {
        pageNo = 1,
        itemsPerPage = 25,
        deskId,
        username,
        startDate = '2021-01-01',
        endDate = new Date().toISOString().split('T')[0],
        sortBy = 'date',
        sortOrder = 'desc',
        pokerModeId,
        gameType,
        mode = 'cash',
    } = req.query;

    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Authentication token is missing or invalid' });
    }

    try {
        const query = {};

        const payload = verifyToken(token);
        if (!payload.userId || payload.role !== 'superadmin') {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        // Filter by pokerModeId if provided
        if (pokerModeId) {
            const pokerDesks = await PokerDesk.find({ pokerModeId }).select('_id');
            const deskIds = pokerDesks.map(desk => desk._id);
            query.deskId = { $in: deskIds };
        }

        // Filter by deskId if provided
        if (deskId) {
            query.deskId = deskId;
        }

        // Filter by username if provided
        if (username) {
            const user = await User.findOne({ username }).select('_id');
            if (user) {
                query['players.userId'] = user._id;
            } else {
                return res.status(200).json({
                    success: true,
                    data: [],
                    pageNo: parseInt(pageNo, 10),
                    itemsPerPage: parseInt(itemsPerPage, 10),
                    totalPages: 0,
                    totalItems: 0
                });
            }
        }

        // Filter by date range
        const start = startOfDay(parseISO(startDate));
        const end = endOfDay(parseISO(endDate));
        query.createdAt = { $gte: start, $lte: end };

        // Filter by mode
        query.mode = mode;

        // Filter by gameType if provided
        if (gameType) {
            query.gameType = gameType;
        }

        // Define sorting options
        const sortOptions = sortBy === 'potAmount'
            ? { totalBet: sortOrder === 'asc' ? 1 : -1 }
            : { createdAt: sortOrder === 'asc' ? 1 : -1 };

        // Pagination options
        const limit = parseInt(itemsPerPage, 10);
        const skip = (parseInt(pageNo, 10) - 1) * limit;

        // Fetch data with filters and pagination
        const pokerGameArchives = await PokerGameArchive.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'players.userId',
                select: 'username' // Populate only username for players
            })
            .populate({
                path: 'pots.winners.playerId',
                select: 'username' // Populate only username for winners in pots
            })
            .select('deskId players pots createdAt totalBet bType stack deskName gameType') // Select only necessary fields
            .exec();

        const formattedData = pokerGameArchives.map(archive => {
      
            return {
                gameArchiveId: archive._id,
                tableId: archive.deskId,
                players: archive.players.map(player => ({
                    username: player.userId ? player.userId.username : 'DeletedUser',
                    totalBet: player.totalBet,
                    status: player.status
                })),
                pots: archive.pots.map(pot => ({
                    winners: pot.winners.map(winner => ({
                        username: winner.playerId ? winner.playerId.username : 'DeletedUser',
                        amount: winner.amount
                    }))
                })),
                deskName : archive.deskName,
                gameType : archive.gameType,
                totalBet: archive.totalBet,
                stack :  archive.stack,
                bType : archive.bType,
                createdAt: archive.createdAt
            };
        });

        const totalCount = await PokerGameArchive.countDocuments(query);

        // Send the response
        res.status(200).json({
            success: true,
            data: formattedData,
            pageNo: parseInt(pageNo, 10),
            itemsPerPage: limit,
            totalPages: Math.ceil(totalCount / limit),
            totalItems: totalCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
}
