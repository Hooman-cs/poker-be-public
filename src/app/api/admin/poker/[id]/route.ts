import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';

import Poker from '@/models/poker';
import PokerMode from '@/models/pokerMode';
import type { IPoker } from '@/models/poker';

type LeanPoker = IPoker & { _id: Types.ObjectId };

const VALID_STATUSES = new Set(['active', 'maintenance', 'disabled']);

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(req);

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AuthError('NOT_FOUND', 'Poker game type not found');
    }

    const body = await req.json().catch(() => ({}));
    const { description, objective, status } = body as {
      description?: unknown;
      objective?: unknown;
      status?: unknown;
    };

    const update: Record<string, unknown> = {};
    if (typeof description === 'string') update.description = description;
    if (typeof objective === 'string') update.objective = objective;
    if (typeof status === 'string' && VALID_STATUSES.has(status)) update.status = status;

    await dbConnect();

    const entry = await Poker.findByIdAndUpdate(
      id,
      update,
      { new: true, runValidators: true }
    ).lean<LeanPoker>();

    if (!entry) {
      throw new AuthError('NOT_FOUND', 'Poker game type not found');
    }

    return successResponse({
      message: 'Poker game type updated',
      game: {
        id: entry._id.toString(),
        gameType: entry.gameType,
        description: entry.description ?? null,
        objective: entry.objective ?? null,
        status: entry.status,
      },
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
      throw new AuthError('NOT_FOUND', 'Poker game type not found');
    }

    await dbConnect();

    const modesExist = await PokerMode.exists({ pokerId: id });
    if (modesExist) {
      throw new AuthError('INVALID_STATE', 'Cannot delete: active modes exist for this game type');
    }

    const deleted = await Poker.findByIdAndDelete(id);
    if (!deleted) {
      throw new AuthError('NOT_FOUND', 'Poker game type not found');
    }

    return successResponse({ message: 'Poker game type deleted' });
  } catch (err) {
    return errorResponse(err);
  }
}
