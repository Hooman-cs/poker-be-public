import dbConnect from '../../config/dbConnect';
import PokerMode from '../../models/pokerMode';
import { verifyToken } from '../../utils/jwt';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token is required' });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const { pokerId, page = '1', itemsPerPage = '10' } = req.body;
    const pageNumber = parseInt(page, 10);
    const limit = parseInt(itemsPerPage, 10);
    const skip = (pageNumber - 1) * limit;
    console.log(pokerId);
    try {
      const pokerModes = await PokerMode.find({ pokerId, status: 'active' }) // Filter by pokerId and status
        .skip(skip)
        .limit(limit)
        .exec();

      const totalCount = await PokerMode.countDocuments({ pokerId, status: 'active' }).exec();
      const totalPages = Math.ceil(totalCount / limit);
        
      // Map the pokerModes to include only necessary details
      const formattedPokerModes = pokerModes.map(mode => {
        const commonData = {
          minBuyIn: mode.minBuyIn,
          maxBuyIn: mode.maxBuyIn,
          mode : mode.mode,
          maxPlayer: mode.maxPlayerCount,
          description: mode.description,
        };

        if (mode.blindsOrAntes === 'blinds') {
          return {
            ...commonData,
            smallBlind: mode.stake, // Assuming stake is used for both small and big blind
            bigBlind: mode.stake, // Example, you might need to handle it differently
          };
        } else if (mode.blindsOrAntes === 'antes') {
          return {
            ...commonData,
            anteAmount: mode.stake,
          };
        }

        return commonData;
      });

      res.status(200).json({
        pokerModes: formattedPokerModes,
        pagination: {
          totalCount,
          totalPages,
          currentPage: pageNumber,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error', error });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
