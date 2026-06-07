import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';

import Poker from '@/models/poker';
import type { IPoker } from '@/models/poker';

type LeanPoker = IPoker & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

const VALID_GAME_TYPES = new Set(["Texas Hold'em", 'Omaha']);
const VALID_STATUSES = new Set(['active', 'maintenance', 'disabled']);

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    await dbConnect();

    const entries = await Poker.find({}).sort({ gameType: 1 }).lean<LeanPoker[]>();

    return successResponse({
      games: entries.map((g) => ({
        id: g._id.toString(),
        gameType: g.gameType,
        description: g.description ?? null,
        objective: g.objective ?? null,
        status: g.status,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const { gameType, description, objective, status } = body as {
      gameType?: unknown;
      description?: unknown;
      objective?: unknown;
      status?: unknown;
    };

    if (typeof gameType !== 'string' || !VALID_GAME_TYPES.has(gameType)) {
      throw new AuthError('INVALID_STATE', "gameType must be \"Texas Hold'em\" or \"Omaha\"");
    }

    await dbConnect();

    const entry = await Poker.create({
      gameType,
      ...(typeof description === 'string' && { description }),
      ...(typeof objective === 'string' && { objective }),
      ...(typeof status === 'string' && VALID_STATUSES.has(status) && { status }),
    });

    return successResponse(
      {
        message: 'Poker game type created',
        game: {
          id: entry._id.toString(),
          gameType: entry.gameType,
          description: entry.description ?? null,
          objective: entry.objective ?? null,
          status: entry.status,
        },
      },
      201
    );
  } catch (err) {
    if (err instanceof Error && (err as { code?: number }).code === 11000) {
      return errorResponse(new AuthError('INVALID_STATE', 'This game type already exists'));
    }
    return errorResponse(err);
  }
}
