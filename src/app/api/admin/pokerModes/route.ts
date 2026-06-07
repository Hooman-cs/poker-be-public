import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { parseAmount, serializeMoney } from '@/lib/api/money';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/config/constants';
import type { Currency } from '@/config/constants';

import Poker from '@/models/poker';
import PokerMode from '@/models/pokerMode';
import type { IPokerMode } from '@/models/pokerMode';

type LeanPokerMode = IPokerMode & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

const VALID_STATUSES = new Set(['active', 'disabled']);
const VALID_MODE_TYPES = new Set(['cash', 'practice']);
const VALID_CURRENCIES = new Set<string>(SUPPORTED_CURRENCIES);
const BLINDS_GAMES = new Set(["Texas Hold'em", 'Omaha']);

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

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const pokerIdParam = searchParams.get('pokerId') ?? '';
    const statusParam = searchParams.get('status') ?? '';
    const modeParam = searchParams.get('mode') ?? '';

    const filter: Record<string, unknown> = {};

    if (pokerIdParam && mongoose.Types.ObjectId.isValid(pokerIdParam)) {
      filter.pokerId = new mongoose.Types.ObjectId(pokerIdParam);
    }
    if (statusParam && VALID_STATUSES.has(statusParam)) {
      filter.status = statusParam;
    }
    if (modeParam && VALID_MODE_TYPES.has(modeParam)) {
      filter.mode = modeParam;
    }

    await dbConnect();

    const modes = await PokerMode.find(filter)
      .sort({ gameType: 1, stake: 1 })
      .lean<LeanPokerMode[]>();

    return successResponse({ modes: modes.map(serializeMode) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({}));

    if (typeof body.pokerId !== 'string' || !mongoose.Types.ObjectId.isValid(body.pokerId)) {
      throw new AuthError('INVALID_STATE', 'pokerId must be a valid ObjectId');
    }

    const currency: Currency =
      typeof body.currency === 'string' && VALID_CURRENCIES.has(body.currency)
        ? (body.currency as Currency)
        : DEFAULT_CURRENCY;

    const stakeVal = parseAmount(body.stake, currency);
    const minBuyInVal = parseAmount(body.minBuyIn, currency);
    const maxBuyInVal = parseAmount(body.maxBuyIn, currency);

    if (maxBuyInVal <= minBuyInVal) {
      throw new AuthError('INVALID_STATE', 'maxBuyIn must be greater than minBuyIn');
    }

    await dbConnect();

    const poker = await Poker.findById(body.pokerId).lean<{ _id: Types.ObjectId; gameType: string }>();
    if (!poker) {
      throw new AuthError('NOT_FOUND', 'Poker game type not found');
    }

    // Derive bType from parent gameType. Must be passed EXPLICITLY — the pre-save
    // hook auto-sets it but fires after validation, so the required field would
    // fail validation before the hook could set it (Phase 1 invariant).
    const bType = BLINDS_GAMES.has(poker.gameType) ? 'blinds' as const : 'antes' as const;

    const entry = await PokerMode.create({
      pokerId: body.pokerId,
      gameType: poker.gameType,
      bType,
      stake: stakeVal,
      minBuyIn: minBuyInVal,
      maxBuyIn: maxBuyInVal,
      currency,
      ...(typeof body.mode === 'string' && VALID_MODE_TYPES.has(body.mode) && { mode: body.mode }),
      ...(typeof body.status === 'string' && VALID_STATUSES.has(body.status) && { status: body.status }),
    });

    return successResponse(
      {
        message: 'Poker mode created',
        mode: {
          id: entry._id.toString(),
          pokerId: entry.pokerId.toString(),
          gameType: entry.gameType,
          bType: entry.bType,
          stake: serializeMoney(entry.stake, entry.currency),
          minBuyIn: serializeMoney(entry.minBuyIn, entry.currency),
          maxBuyIn: serializeMoney(entry.maxBuyIn, entry.currency),
          currency: entry.currency,
          mode: entry.mode,
          status: entry.status,
        },
      },
      201
    );
  } catch (err) {
    return errorResponse(err);
  }
}
