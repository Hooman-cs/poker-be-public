import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../config/dbConnect';
import BankTransaction from '../../../../models/bankTransaction';
import User from '../../../../models/user';
import BankAccount from '../../../../models/bankAccount';
import mongoose from 'mongoose';
import { verifyToken } from '../../../../utils/jwt';
import cookie from 'cookie';

export default async function handler(req, res) {
  await dbConnect();

  const { page = 1, limit = 10, search = '' } = req.query;

  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;
  // Extract cookies from the request headers using the 'cookie' package
 // const token = req.cookies.get('token')?.value
  console.log("token", token);
  
  // Check if token is missing or invalid
  if (!token) {
    return res.status(401).json({ message: 'Authentication token is missing or invalid' });
  }

  try {
    // Verify JWT token
    const payload = await verifyToken(token);
    if (!payload.userId || !payload.role ) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    const pageNumber = parseInt(page);
    const pageLimit = parseInt(limit);

    // Construct filters based on query parameters
    const query = {};

    if (search) {
      query.$or = [
        { 'players.username': { $regex: search, $options: 'i' } },
        { 'currentTurnPlayer.username': { $regex: search, $options: 'i' } },
      ];
    }
  
    const archivedGames = await PokerGameArchive.find(query)
      .populate('players.userId', 'username')
      .populate('currentTurnPlayer', 'username')
      .select('deskId players pot status rounds createdAt updatedAt pots')
      .skip((pageNumber - 1) * pageLimit)
      .limit(parseInt(pageLimit))
      .lean();
  
    if (!archivedGames || archivedGames.length === 0) {
      return res.status(404).json({ message: 'No games found' });
    }
  
    const formattedGames = archivedGames.map(game => {
      const winners = Array.isArray(game.pots) ? game.pots.flatMap(pot => pot.winners) : [];
      return {
        deskId: game.deskId,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
        pot: game.pot,
        status: game.status,
        winners: winners.map(winner => ({
          playerId: winner.playerId,
          amount: winner.amount,
        })),
      };
    });
    

    return res.status(200).json({ formattedGames });
  } catch (error) {
    console.error('Error fetching transactions:', error.message || error);
    return res.status(500).json({ message: `Failed to fetch transactions: ${error.message || 'Unknown error'}` });
  }
};
 
