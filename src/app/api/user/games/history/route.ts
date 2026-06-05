import { NextRequest } from 'next/server';
import type { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireUser } from '@/lib/auth/requireUser';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';
import PokerGameArchive from '@/models/pokerGameArchive';
import type { IPokerGameArchive } from '@/models/pokerGameArchive';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// completedAt is a schema field on IPokerGameArchive; createdAt comes from timestamps: true.
type ArchiveLean = IPokerGameArchive & { _id: Types.ObjectId; createdAt: Date };

export async function GET(req: NextRequest) {
  try {
    const { userId } = requireUser(req);
    await dbConnect();

    const sp = req.nextUrl.searchParams;
    const rawPage = parseInt(sp.get('page') ?? '1', 10);
    const rawLimit = parseInt(sp.get('limit') ?? String(DEFAULT_LIMIT), 10);

    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

    const [archives, total] = await Promise.all([
      PokerGameArchive.find({ 'players.userId': userId })
        .sort({ completedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<ArchiveLean[]>(),
      PokerGameArchive.countDocuments({ 'players.userId': userId }),
    ]);

    const games = [];

    for (const archive of archives) {
      const me = archive.players.find((p) => p.userId.toString() === userId);
      if (!me) continue;

      games.push({
        archiveId: archive._id.toString(),
        gameType: archive.gameType,
        completedAt: archive.completedAt,
        totalPot: serializeMoney(archive.totalPot, archive.currency),
        myResult: {
          startingStack: serializeMoney(me.startingStack, archive.currency),
          endingStack: serializeMoney(me.endingStack, archive.currency),
          totalBet: serializeMoney(me.totalBet, archive.currency),
          isWinner: me.isWinner,
        },
        players: archive.players.map((p) => ({
          username: p.username,
          isWinner: p.isWinner,
        })),
        pots: archive.pots.map((pot) => ({
          potNumber: pot.potNumber,
          totalAmount: serializeMoney(pot.totalAmount, archive.currency),
          winners: pot.winners.map((w) => ({
            username: w.username,
            amount: serializeMoney(w.amount, archive.currency),
            handDescription: w.handDescription ?? null,
          })),
        })),
      });
    }

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
