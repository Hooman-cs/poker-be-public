/**
 * @fileoverview Admin Game Archives List API Route (App Router)
 * Handles fetching, filtering, and paginating historical poker games.
 * Path: GET /api/admin/games
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/config/dbConnect';
import PokerGameArchive from '@/models/pokerGameArchive';
import User from '@/models/user';
import PokerDesk from '@/models/pokerDesk';
import { verifyToken } from '@/utils/jwt';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

interface JwtPayload {
  userId: string;
  role: string;
}

// -----------------------------------------------------------------------------
// Route Handler
// -----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Establish Database Connection
    await dbConnect();

    // 2. Authentication & Authorization Check
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Authentication token is missing' }, { status: 401 });
    }

    const payload = (await verifyToken(token)) as JwtPayload;
    if (!payload.userId || payload.role !== 'superadmin') {
      return NextResponse.json({ message: 'Unauthorized access' }, { status: 403 });
    }

    // 3. Parse URL Search Parameters
    const searchParams = request.nextUrl.searchParams;
    const pageNo = parseInt(searchParams.get('pageNo') || '1', 10);
    const itemsPerPage = parseInt(searchParams.get('itemsPerPage') || '25', 10);
    const deskId = searchParams.get('deskId');
    const username = searchParams.get('username');
    const startDate = searchParams.get('startDate') || '2021-01-01';
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const pokerModeId = searchParams.get('pokerModeId');
    const gameType = searchParams.get('gameType');
    const mode = searchParams.get('mode') || 'cash';

    // 4. Construct Query Filters
    const query: Record<string, any> = { mode };

    if (gameType) {
      query.gameType = gameType;
    }

    // A. Filter by Poker Mode
    if (pokerModeId && mongoose.Types.ObjectId.isValid(pokerModeId)) {
      const pokerDesks = await PokerDesk.find({ pokerModeId }).select('_id').lean().exec();
      const deskIds = pokerDesks.map(desk => desk._id);
      query.deskId = { $in: deskIds };
    }

    // B. Filter by Desk ID
    if (deskId && mongoose.Types.ObjectId.isValid(deskId)) {
      query.deskId = new mongoose.Types.ObjectId(deskId);
    }

    // C. Filter by Username (Early exit optimization if user not found)
    if (username) {
      const user = await User.findOne({ username }).select('_id').lean().exec();
      if (user) {
        query['players.userId'] = user._id;
      } else {
        // Return empty instantly to save database load
        return NextResponse.json({
          success: true,
          data: [],
          pageNo,
          itemsPerPage,
          totalPages: 0,
          totalItems: 0
        }, { status: 200 });
      }
    }

    // D. Filter by Date Range (Vanilla JS replacement for date-fns to reduce overhead)
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: start, $lte: end };

    // 5. Sorting and Pagination Configuration
    const sortOptions: Record<string, 1 | -1> = sortBy === 'potAmount'
      ? { totalBet: sortOrder === 'asc' ? 1 : -1 }
      : { createdAt: sortOrder === 'asc' ? 1 : -1 };

    const limit = itemsPerPage;
    const skip = (pageNo - 1) * limit;

    // 6. Execute Queries in Parallel (Optimized via .lean())
    const [pokerGameArchives, totalCount] = await Promise.all([
      PokerGameArchive.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate({ path: 'players.userId', select: 'username' })
        .populate({ path: 'pots.winners.playerId', select: 'username' })
        .select('deskId players pots createdAt totalBet bType stack deskName gameType')
        .lean()
        .exec(),
      PokerGameArchive.countDocuments(query).exec()
    ]);

    // 7. Map and Sanitize Payload
    const formattedData = pokerGameArchives.map((archive: any) => ({
      gameArchiveId: archive._id,
      tableId: archive.deskId,
      players: archive.players?.map((player: any) => ({
        username: player.userId?.username || 'DeletedUser',
        totalBet: player.totalBet,
        status: player.status
      })) || [],
      pots: archive.pots?.map((pot: any) => ({
        winners: pot.winners?.map((winner: any) => ({
          username: winner.playerId?.username || 'DeletedUser',
          amount: winner.amount
        })) || []
      })) || [],
      deskName: archive.deskName,
      gameType: archive.gameType,
      totalBet: archive.totalBet,
      stack: archive.stack,
      bType: archive.bType,
      createdAt: archive.createdAt
    }));

    // 8. Return Response
    return NextResponse.json({
      success: true,
      data: formattedData,
      pageNo,
      itemsPerPage: limit,
      totalPages: Math.ceil(totalCount / limit),
      totalItems: totalCount
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Get Games List API Error]:', error.message);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}