import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';

import PokerDesk from '@/models/pokerDesk';
import PokerMode from '@/models/pokerMode';
import type { IPokerDesk } from '@/models/pokerDesk';
import type { IPokerMode } from '@/models/pokerMode';

type LeanPokerDesk = IPokerDesk & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
type LeanPokerMode = IPokerMode & { _id: Types.ObjectId };

const VALID_STATUSES = new Set(['active', 'disabled', 'closed']);
const VALID_MODE_TYPES = new Set(['cash', 'practice']);

function serializeDesk(d: LeanPokerDesk) {
  return {
    id: d._id.toString(),
    pokerModeId: d.pokerModeId.toString(),
    tableName: d.tableName,
    gameType: d.gameType,
    bType: d.bType,
    mode: d.mode,
    currency: d.currency,
    status: d.status,
    stake: serializeMoney(d.stake, d.currency),
    minBuyIn: serializeMoney(d.minBuyIn, d.currency),
    maxBuyIn: serializeMoney(d.maxBuyIn, d.currency),
    minToStart: d.minToStart,
    minToContinue: d.minToContinue,
    maxPlayerCount: d.maxPlayerCount,
    maxSeats: d.maxSeats,
    seatedCount: d.seats.length,
    currentGameStatus: d.currentGameStatus,
    buttonSeatNumber: d.buttonSeatNumber,
    firstGameStartedAt: d.firstGameStartedAt,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const pokerModeIdParam = searchParams.get('pokerModeId') ?? '';
    const statusParam = searchParams.get('status') ?? '';
    const modeParam = searchParams.get('mode') ?? '';

    const filter: Record<string, unknown> = {};

    if (pokerModeIdParam && mongoose.Types.ObjectId.isValid(pokerModeIdParam)) {
      filter.pokerModeId = new mongoose.Types.ObjectId(pokerModeIdParam);
    }
    if (statusParam && VALID_STATUSES.has(statusParam)) {
      filter.status = statusParam;
    }
    if (modeParam && VALID_MODE_TYPES.has(modeParam)) {
      filter.mode = modeParam;
    }

    await dbConnect();

    const desks = await PokerDesk.find(filter)
      .sort({ createdAt: -1 })
      .lean<LeanPokerDesk[]>();

    return successResponse({ desks: desks.map(serializeDesk) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({}));

    if (typeof body.pokerModeId !== 'string' || !mongoose.Types.ObjectId.isValid(body.pokerModeId)) {
      throw new AuthError('INVALID_STATE', 'pokerModeId must be a valid ObjectId');
    }
    if (typeof body.tableName !== 'string' || !body.tableName.trim()) {
      throw new AuthError('INVALID_STATE', 'tableName is required');
    }

    // Parse player-count fields; fall back to schema defaults where safe
    const minToStart =
      Number.isInteger(body.minToStart) && (body.minToStart as number) >= 3
        ? (body.minToStart as number)
        : 3;
    const minToContinue =
      Number.isInteger(body.minToContinue) && (body.minToContinue as number) >= 3
        ? (body.minToContinue as number)
        : 3;
    const maxPlayerCount =
      Number.isInteger(body.maxPlayerCount) && (body.maxPlayerCount as number) >= 1
        ? (body.maxPlayerCount as number)
        : 6;

    // Cross-field validation BEFORE dbConnect — pre-save hooks do not run on create
    // via findByIdAndUpdate and may not surface clean errors otherwise
    if (maxPlayerCount < minToStart) {
      throw new AuthError('INVALID_STATE', 'maxPlayerCount must be >= minToStart');
    }
    if (minToContinue > minToStart) {
      throw new AuthError('INVALID_STATE', 'minToContinue must be <= minToStart');
    }

    const isPractice = body.isPractice === true; // default false if absent

    await dbConnect();

    const pokerMode = await PokerMode.findById(body.pokerModeId).lean<LeanPokerMode>();
    if (!pokerMode) {
      throw new AuthError('NOT_FOUND', 'Poker mode not found');
    }

    const desk = await PokerDesk.create({
      pokerModeId: body.pokerModeId,
      tableName: (body.tableName as string).trim(),
      // Inherited from parent PokerMode — not taken from body
      gameType: pokerMode.gameType,
      bType: pokerMode.bType,
      stake: pokerMode.stake,
      minBuyIn: pokerMode.minBuyIn,
      maxBuyIn: pokerMode.maxBuyIn,
      currency: pokerMode.currency,
      mode: pokerMode.mode,
      // Admin-configured
      minToStart,
      minToContinue,
      maxPlayerCount,
      maxSeats: maxPlayerCount, // mirrors maxPlayerCount on creation
      isPractice,
    });

    return successResponse(
      {
        message: 'Poker desk created',
        desk: serializeDesk(desk.toObject() as unknown as LeanPokerDesk),
      },
      201
    );
  } catch (err) {
    return errorResponse(err);
  }
}
