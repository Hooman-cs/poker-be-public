import { NextRequest } from 'next/server';
import mongoose, { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { AuthError, successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';
import { DEFAULT_CURRENCY } from '@/config/constants';
import type { Currency } from '@/config/constants';

import PokerGameArchive from '@/models/pokerGameArchive';
import type { IPokerGameArchive } from '@/models/pokerGameArchive';

type LeanArchive = IPokerGameArchive & { _id: Types.ObjectId };

type StatsResult = {
  _id: Types.ObjectId;
  gamesPlayed: number;
  wins: number;
  totalNetChange: number;
  totalBet: number;
  currency: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await requireAdmin(req);

    const { userId } = params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AuthError('NOT_FOUND', 'User not found');
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));

    await dbConnect();

    const userObjectId = new Types.ObjectId(userId);

    const [statsResult, total, archives] = await Promise.all([
      PokerGameArchive.aggregate<StatsResult>([
        { $match: { 'players.userId': userObjectId } },
        { $unwind: '$players' },
        { $match: { 'players.userId': userObjectId } },
        {
          $group: {
            _id: '$players.userId',
            gamesPlayed: { $sum: 1 },
            wins: { $sum: { $cond: ['$players.isWinner', 1, 0] } },
            totalNetChange: {
              $sum: { $subtract: ['$players.endingStack', '$players.startingStack'] },
            },
            totalBet: { $sum: '$players.totalBet' },
            currency: { $last: '$currency' },
          },
        },
      ]),
      PokerGameArchive.countDocuments({ 'players.userId': userObjectId }),
      PokerGameArchive.find({ 'players.userId': userObjectId })
        .sort({ completedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanArchive[]>(),
    ]);

    const raw = statsResult[0] ?? null;
    const currency = (raw?.currency as Currency) ?? DEFAULT_CURRENCY;

    const stats = raw
      ? {
          gamesPlayed: raw.gamesPlayed,
          wins: raw.wins,
          winRate:
            raw.gamesPlayed > 0
              ? ((raw.wins / raw.gamesPlayed) * 100).toFixed(1) + '%'
              : '0.0%',
          totalNetChange: serializeMoney(raw.totalNetChange, currency),
          totalBet: serializeMoney(raw.totalBet, currency),
          currency,
        }
      : null;

    const games = archives.map((archive) => {
      const player = archive.players.find(
        (p) => p.userId.toString() === userId
      );
      return {
        id: archive._id.toString(),
        gameType: archive.gameType,
        currency: archive.currency,
        totalPot: serializeMoney(archive.totalPot, archive.currency),
        isWinner: player?.isWinner ?? false,
        netChange: serializeMoney(
          (player?.endingStack ?? 0) - (player?.startingStack ?? 0),
          archive.currency
        ),
        startedAt: archive.startedAt,
        completedAt: archive.completedAt,
        durationSeconds: Math.round(
          (archive.completedAt.getTime() - archive.startedAt.getTime()) / 1000
        ),
      };
    });

    return successResponse({
      stats,
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
