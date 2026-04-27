import dbConnect from '@/config/dbConnect';
import PokerDesk from '../../models/pokerDesk';
import { verifyToken } from '@/utils/jwt';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  // Ensure the database is connected
  await dbConnect();

  // Only allow POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    // Check for token and extract it
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token is required' });
    }

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Extract pokerModeId from body and validate
    const { pokerModeId } = req.body;
    if (!pokerModeId) {
      return res.status(400).json({ message: 'Poker mode ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(pokerModeId)) {
      return res.status(400).json({ message: 'Invalid Poker Mode ID' });
    }

    // Fetch poker desks for the given pokerModeId
    const pokerDesks = await PokerDesk.find({ pokerModeId })
    .populate('seats.userId', 'username') // Populate the userId in seats with username
    .exec();

    if (pokerDesks.length === 0) {
      return res.status(404).json({ message: 'No poker desks available for the specified poker mode' });
    }

    // Sort desks based on the number of seats and observers
    const sortedDesks = pokerDesks
      .filter(desk => desk.seats.length > 0 && desk.seats.length <= desk.maxSeats * 0.75)
      .sort((a, b) => {
        if (a.seats.length !== b.seats.length) {
          return a.seats.length - b.seats.length;
        }
        return a.observers.length - b.observers.length;
      });

    const bestDesk = sortedDesks[0] || pokerDesks[0];

    const formattedSeats = bestDesk.seats
    .map((seat) => {
      if (seat.userId) {
        return {
          userId: seat.userId._id.toString(),
          username: seat.userId.username,
          seatNumber: seat.seatNumber,
          buyInAmount: seat.buyInAmount,
          balanceAtTable: seat.balanceAtTable,
          status: seat.status || 'active',
        };
      } else {
        return null;
      }
    })
    .filter((seat) => seat !== null);

    // Return a valid response with additional information
    return res.status(200).json({
      id: bestDesk._id,
      seats: formattedSeats,
      pokerModeId: bestDesk.pokerModeId,
      tableName: bestDesk.tableName,
      maxSeats: bestDesk.maxSeats,
      minBuyIn: bestDesk.minBuyIn,
      maxBuyIn: bestDesk.maxBuyIn,
      message: 'Best table found',
    });

  } catch (error) {
    // Log the error for debugging purposes
    console.error('Error occurred:', error);

    // Return a generic error response
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}
