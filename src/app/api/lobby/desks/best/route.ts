import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import type { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireUser } from '@/lib/auth/requireUser';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';

import PokerMode from '@/models/pokerMode';
import PokerDesk from '@/models/pokerDesk';

import type { IPokerMode } from '@/models/pokerMode';
import type { IPokerDesk } from '@/models/pokerDesk';

type LeanMode = IPokerMode & { _id: Types.ObjectId };
type LeanDesk = IPokerDesk & { _id: Types.ObjectId };

export async function GET(req: NextRequest) {
  try {
    requireUser(req);
    await dbConnect();

    const modeId = req.nextUrl.searchParams.get('modeId');
    if (!modeId) {
      throw new AuthError('MISSING_MODE_ID', 'modeId query param is required');
    }

    if (!mongoose.Types.ObjectId.isValid(modeId)) {
      throw new AuthError('NOT_FOUND', 'PokerMode not found');
    }

    const mode = await PokerMode.findById(modeId).lean<LeanMode>();
    if (!mode || mode.status !== 'active') {
      throw new AuthError('NOT_FOUND', 'PokerMode not found or not active');
    }

    const [desk] = await PokerDesk.find({
      pokerModeId: modeId,
      status: 'active',
      $expr: { $lt: [{ $size: '$seats' }, '$maxPlayerCount'] },
    })
      .sort({ seats: -1 })
      .limit(1)
      .lean<LeanDesk[]>();

    if (!desk) {
      return successResponse({ desk: null });
    }

    // stake/minBuyIn/maxBuyIn/mode fields live on IPokerMode, not IPokerDesk.
    // The mode document loaded above is used as the authoritative source.
    return successResponse({
      desk: {
        deskId: desk._id.toString(),
        tableName: desk.tableName,
        playerCount: desk.seats.length,
        maxPlayers: desk.maxPlayerCount,
        availableSeats: desk.maxPlayerCount - desk.seats.length,
        gameStatus: desk.currentGameStatus,
        stake: serializeMoney(mode.stake, mode.currency),
        bigBlind: serializeMoney(mode.stake * 2, mode.currency),
        minBuyIn: serializeMoney(mode.minBuyIn, mode.currency),
        maxBuyIn: serializeMoney(mode.maxBuyIn, mode.currency),
        currency: mode.currency,
        mode: mode.mode,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
