import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { parseAmount, serializeMoney } from '@/lib/api/money';

import PokerMode from '@/models/pokerMode';
import PokerDesk from '@/models/pokerDesk';
import type { IPokerMode } from '@/models/pokerMode';

type LeanPokerMode = IPokerMode & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

const VALID_STATUSES = new Set(['active', 'disabled']);
const VALID_MODE_TYPES = new Set(['cash', 'practice']);

function serializeMode(m: LeanPokerMode) {
  return {
    id: m._id.toString(),
    pokerId: m.pokerId.toString(),
    gameType: m.gameType,
    bType: m.bType,
    stake: serializeMoney(m.stake, m.currency),
    minBuyIn: serializeMoney(m.minBuyIn, m.currency),
    maxBuyIn: serializeMoney(m.maxBuyIn, m.currency),
    currency: m.currency,
    mode: m.mode,
    status: m.status,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
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
      throw new AuthError('NOT_FOUND', 'Poker mode not found');
    }

    const body = await req.json().catch(() => ({}));

    // pokerId / gameType / bType are silently ignored — not updatable
    const update: Record<string, unknown> = {};

    if (typeof body.status === 'string' && VALID_STATUSES.has(body.status)) {
      update.status = body.status;
    }
    if (typeof body.mode === 'string' && VALID_MODE_TYPES.has(body.mode)) {
      update.mode = body.mode;
    }

    await dbConnect();

    const hasMoneyField =
      body.stake !== undefined || body.minBuyIn !== undefined || body.maxBuyIn !== undefined;

    if (hasMoneyField) {
      // Load current doc for: (a) currency context for parseAmount,
      // (b) cross-field validation when only one of min/max is updated.
      const current = await PokerMode.findById(id).lean<LeanPokerMode>();
      if (!current) {
        throw new AuthError('NOT_FOUND', 'Poker mode not found');
      }

      const { currency } = current;

      if (body.stake !== undefined) {
        update.stake = parseAmount(body.stake, currency);
      }

      if (body.minBuyIn !== undefined || body.maxBuyIn !== undefined) {
        const newMin =
          body.minBuyIn !== undefined
            ? parseAmount(body.minBuyIn, currency)
            : current.minBuyIn;
        const newMax =
          body.maxBuyIn !== undefined
            ? parseAmount(body.maxBuyIn, currency)
            : current.maxBuyIn;

        if (newMax <= newMin) {
          throw new AuthError('INVALID_STATE', 'maxBuyIn must be greater than minBuyIn');
        }

        if (body.minBuyIn !== undefined) update.minBuyIn = newMin;
        if (body.maxBuyIn !== undefined) update.maxBuyIn = newMax;
      }
    }

    const entry = await PokerMode.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean<LeanPokerMode>();

    if (!entry) {
      throw new AuthError('NOT_FOUND', 'Poker mode not found');
    }

    return successResponse({
      message: 'Poker mode updated',
      mode: serializeMode(entry),
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
      throw new AuthError('NOT_FOUND', 'Poker mode not found');
    }

    await dbConnect();

    const desksExist = await PokerDesk.exists({ pokerModeId: id });
    if (desksExist) {
      throw new AuthError('INVALID_STATE', 'Cannot delete: desks exist for this poker mode');
    }

    const deleted = await PokerMode.findByIdAndDelete(id);
    if (!deleted) {
      throw new AuthError('NOT_FOUND', 'Poker mode not found');
    }

    return successResponse({ message: 'Poker mode deleted' });
  } catch (err) {
    return errorResponse(err);
  }
}
