import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';

import PokerGameArchive from '@/models/pokerGameArchive';
import type { IPokerGameArchive } from '@/models/pokerGameArchive';

type LeanArchive = IPokerGameArchive & { _id: Types.ObjectId };

const VALID_GAME_TYPES = new Set([
  "Texas Hold'em",
  'Omaha',
  'Seven-Card Stud',
  'Razz',
  'Five-Card Draw',
]);

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
    const deskIdParam = searchParams.get('deskId') ?? '';
    const pokerModeIdParam = searchParams.get('pokerModeId') ?? '';
    const gameTypeParam = searchParams.get('gameType') ?? '';
    const fromParam = searchParams.get('from') ?? '';
    const toParam = searchParams.get('to') ?? '';

    const filter: Record<string, unknown> = {};

    if (deskIdParam && mongoose.Types.ObjectId.isValid(deskIdParam)) {
      filter.deskId = new mongoose.Types.ObjectId(deskIdParam);
    }
    if (pokerModeIdParam && mongoose.Types.ObjectId.isValid(pokerModeIdParam)) {
      filter.pokerModeId = new mongoose.Types.ObjectId(pokerModeIdParam);
    }
    if (gameTypeParam && VALID_GAME_TYPES.has(gameTypeParam)) {
      filter.gameType = gameTypeParam;
    }

    // Date range on completedAt — include only if the string parses to a valid date
    const fromDate = fromParam ? new Date(fromParam) : null;
    const toDate = toParam ? new Date(toParam) : null;
    const hasFrom = fromDate !== null && !isNaN(fromDate.getTime());
    const hasTo = toDate !== null && !isNaN(toDate.getTime());
    if (hasFrom || hasTo) {
      const dateFilter: Record<string, Date> = {};
      if (hasFrom) dateFilter.$gte = fromDate!;
      if (hasTo) dateFilter.$lte = toDate!;
      filter.completedAt = dateFilter;
    }

    await dbConnect();

    const [total, archives] = await Promise.all([
      PokerGameArchive.countDocuments(filter),
      PokerGameArchive.find(filter)
        .sort({ completedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanArchive[]>(),
    ]);

    const games = archives.map((archive) => ({
      id: archive._id.toString(),
      deskId: archive.deskId.toString(),
      pokerModeId: archive.pokerModeId.toString(),
      gameType: archive.gameType,
      currency: archive.currency,
      totalPot: serializeMoney(archive.totalPot, archive.currency),
      playerCount: archive.players.length,
      durationSeconds: Math.round(
        (archive.completedAt.getTime() - archive.startedAt.getTime()) / 1000
      ),
      startedAt: archive.startedAt,
      completedAt: archive.completedAt,
      players: archive.players.map((p) => ({
        userId: p.userId.toString(),
        username: p.username,
        isWinner: p.isWinner,
        netChange: serializeMoney(p.endingStack - p.startingStack, archive.currency),
      })),
    }));

    return successResponse({
      games,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
