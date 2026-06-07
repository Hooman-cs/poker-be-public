import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';

import PokerDesk from '@/models/pokerDesk';
import type { IPokerDesk } from '@/models/pokerDesk';

type LeanPokerDesk = IPokerDesk & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

// 'closed' is engine-only — not settable by admin
const ADMIN_SETTABLE_STATUSES = new Set(['active', 'disabled']);

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

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(req);

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AuthError('NOT_FOUND', 'Poker desk not found');
    }

    const body = await req.json().catch(() => ({}));

    await dbConnect();

    // Always load current doc — needed for cross-field merge-validation since
    // pre-save hooks do not run via findByIdAndUpdate.
    const current = await PokerDesk.findById(id).lean<LeanPokerDesk>();
    if (!current) {
      throw new AuthError('NOT_FOUND', 'Poker desk not found');
    }

    // Build update object; pokerModeId/gameType/bType/stake/minBuyIn/maxBuyIn/currency/mode
    // are inherited-only and silently ignored if present in the body.
    const update: Record<string, unknown> = {};

    if (typeof body.tableName === 'string' && body.tableName.trim()) {
      update.tableName = (body.tableName as string).trim();
    }
    if (typeof body.status === 'string' && ADMIN_SETTABLE_STATUSES.has(body.status)) {
      update.status = body.status;
    }

    // Parse player-count fields if provided
    if (Number.isInteger(body.minToStart) && (body.minToStart as number) >= 3) {
      update.minToStart = body.minToStart;
    }
    if (Number.isInteger(body.minToContinue) && (body.minToContinue as number) >= 3) {
      update.minToContinue = body.minToContinue;
    }
    if (Number.isInteger(body.maxPlayerCount) && (body.maxPlayerCount as number) >= 1) {
      update.maxPlayerCount = body.maxPlayerCount;
    }

    // Cross-field validation using effective (merged) values.
    // pre-save hooks don't run on findByIdAndUpdate, so this must be manual.
    const effectiveMinToStart =
      (update.minToStart as number | undefined) ?? current.minToStart;
    const effectiveMinToContinue =
      (update.minToContinue as number | undefined) ?? current.minToContinue;
    const effectiveMaxPlayerCount =
      (update.maxPlayerCount as number | undefined) ?? current.maxPlayerCount;

    if (effectiveMaxPlayerCount < effectiveMinToStart) {
      throw new AuthError('INVALID_STATE', 'maxPlayerCount must be >= minToStart');
    }
    if (effectiveMinToContinue > effectiveMinToStart) {
      throw new AuthError('INVALID_STATE', 'minToContinue must be <= minToStart');
    }

    const entry = await PokerDesk.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean<LeanPokerDesk>();

    if (!entry) {
      throw new AuthError('NOT_FOUND', 'Poker desk not found');
    }

    return successResponse({
      message: 'Poker desk updated',
      desk: serializeDesk(entry),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(req);

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AuthError('NOT_FOUND', 'Poker desk not found');
    }

    await dbConnect();

    const desk = await PokerDesk.findById(id).lean<LeanPokerDesk>();
    if (!desk) {
      throw new AuthError('NOT_FOUND', 'Poker desk not found');
    }

    if (desk.seats.length > 0) {
      throw new AuthError('INVALID_STATE', 'Cannot delete: players are seated at this desk');
    }
    if (desk.currentGameStatus === 'in-progress') {
      throw new AuthError('INVALID_STATE', 'Cannot delete: a game is in progress');
    }

    await PokerDesk.findByIdAndDelete(id);

    return successResponse({ message: 'Poker desk deleted' });
  } catch (err) {
    return errorResponse(err);
  }
}
