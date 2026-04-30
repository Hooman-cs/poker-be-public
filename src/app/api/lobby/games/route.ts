/**
 * @fileoverview Client Lobby Games API (App Router)
 * Fetches all active Poker Games, nested with their respective Modes,
 * including real-time live player counts and seat availability.
 * Path: GET /api/lobby/games
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import Poker from '@/models/poker';
import PokerMode from '@/models/pokerMode';
import PokerDesk from '@/models/pokerDesk';
import { verifyToken } from '@/utils/jwt';
import { IPoker, IPokerMode } from '@/utils/pokerModelTypes';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Standard Client Auth Check (Bearer Token)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ message: 'Authentication token is required' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // 2. Fetch Base Poker Games
    const pokers = (await Poker.find({ status: { $in: ['active', 'maintenance'] } })
      .select('name rules description objective gameType status')
      .lean()
      .exec()) as unknown as IPoker[];

    // 3. Concurrently Fetch Modes and Calculate Live Stats for each Game
    const lobbyDataPromises = pokers.map(async (poker) => {
      const pokerModes = (await PokerMode.find({ pokerId: poker._id, status: 'active' })
        .lean()
        .exec()) as unknown as IPokerMode[];

      const modesWithStatsPromises = pokerModes.map(async (mode) => {
        // Aggregate real-time seating data across all active desks for this mode
        const deskStats = await PokerDesk.aggregate([
          { $match: { pokerModeId: mode._id, status: 'active' } },
          {
            $group: {
              _id: null,
              totalSeats: { $sum: '$maxSeats' },
              livePlayers: {
                $sum: {
                  $size: {
                    $filter: {
                      input: '$seats',
                      as: 'seat',
                      cond: { $eq: ['$$seat.status', 'active'] },
                    },
                  },
                },
              },
            },
          },
        ]);

        const stats = deskStats[0] || { totalSeats: 0, livePlayers: 0 };

        // Construct Mode Payload
        const modePayload: any = {
          pokerModeId: mode._id,
          mode: mode.mode,
          minBuyIn: mode.minBuyIn,
          maxBuyIn: mode.maxBuyIn,
          bType: mode.bType,
          totalSeats: stats.totalSeats,
          livePlayers: stats.livePlayers,
        };

        if (mode.bType === 'blinds') {
          modePayload.smallBlind = mode.stake;
          modePayload.bigBlind = mode.stake; // Note: Logic maintained from legacy file
        } else if (mode.bType === 'antes') {
          modePayload.anteAmount = mode.stake;
        }

        return modePayload;
      });

      const resolvedModes = await Promise.all(modesWithStatsPromises);

      return {
        pokerId: poker._id,
        name: poker.name,
        gameType: poker.gameType,
        objective: poker.objective,
        rules: poker.rules,
        status: poker.status,
        description: poker.description,
        pokerModes: resolvedModes,
      };
    });

    // 4. Resolve full lobby hierarchy and return
    const fullLobbyData = await Promise.all(lobbyDataPromises);

    return NextResponse.json(fullLobbyData, { status: 200 });

  } catch (error: any) {
    console.error('[Lobby API Error]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}