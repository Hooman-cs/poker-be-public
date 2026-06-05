import { NextRequest } from 'next/server';
import type { Types } from 'mongoose';

import dbConnect from '@/config/dbConnect';
import { requireUser } from '@/lib/auth/requireUser';
import { successResponse, errorResponse } from '@/lib/api/errors';
import { serializeMoney } from '@/lib/api/money';

import Poker from '@/models/poker';
import PokerMode from '@/models/pokerMode';
import PokerDesk from '@/models/pokerDesk';

import type { IPoker } from '@/models/poker';
import type { IPokerMode } from '@/models/pokerMode';
import type { IPokerDesk } from '@/models/pokerDesk';

type LeanPoker = IPoker & { _id: Types.ObjectId };
type LeanMode = IPokerMode & { _id: Types.ObjectId };
type LeanDesk = IPokerDesk & { _id: Types.ObjectId };

export async function GET(req: NextRequest) {
  try {
    requireUser(req);
    await dbConnect();

    const pokers = await Poker.find({ status: 'active' }).lean<LeanPoker[]>();

    const modes = await PokerMode.find({
      pokerId: { $in: pokers.map((p) => p._id) },
      status: 'active',
    }).lean<LeanMode[]>();

    const desks = await PokerDesk.find({
      pokerModeId: { $in: modes.map((m) => m._id) },
      status: 'active',
    }).lean<LeanDesk[]>();

    const modesByPokerId = new Map<string, LeanMode[]>();
    for (const mode of modes) {
      const key = mode.pokerId.toString();
      const bucket = modesByPokerId.get(key) ?? [];
      bucket.push(mode);
      modesByPokerId.set(key, bucket);
    }

    const desksByModeId = new Map<string, LeanDesk[]>();
    for (const desk of desks) {
      const key = desk.pokerModeId.toString();
      const bucket = desksByModeId.get(key) ?? [];
      bucket.push(desk);
      desksByModeId.set(key, bucket);
    }

    const games = pokers.map((poker) => {
      const pokerModes = modesByPokerId.get(poker._id.toString()) ?? [];

      return {
        pokerGameId: poker._id.toString(),
        gameType: poker.gameType,
        description: poker.description ?? null,
        modes: pokerModes.map((mode) => {
          const modeDesks = desksByModeId.get(mode._id.toString()) ?? [];

          return {
            modeId: mode._id.toString(),
            modeType: mode.mode,
            stake: serializeMoney(mode.stake, mode.currency),
            bigBlind: serializeMoney(mode.stake * 2, mode.currency),
            minBuyIn: serializeMoney(mode.minBuyIn, mode.currency),
            maxBuyIn: serializeMoney(mode.maxBuyIn, mode.currency),
            currency: mode.currency,
            desks: modeDesks.map((desk) => ({
              deskId: desk._id.toString(),
              tableName: desk.tableName,
              playerCount: desk.seats.length,
              maxPlayers: desk.maxPlayerCount,
              gameStatus: desk.currentGameStatus,
              totalPot: serializeMoney(
                desk.currentGame?.totalBet ?? 0,
                desk.currency
              ),
            })),
          };
        }),
      };
    });

    return successResponse({ games });
  } catch (err) {
    return errorResponse(err);
  }
}
