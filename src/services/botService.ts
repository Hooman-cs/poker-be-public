import { Types } from 'mongoose';
import PokerDesk, { IPokerDeskDocument, ISeat } from '@/models/pokerDesk';
import { withDeskLock, InvalidStateError, NotFoundError } from '@/services/gameService';
import Bot from '@/models/bot';
import { generateGamerName } from '@/utils/helpers';
import { PRACTICE_STARTING_CHIPS } from '@/config/constants';
import type { BotDifficulty } from '@/config/constants';

export interface AddBotToSeatResult {
  desk: IPokerDeskDocument;
  botUserId: Types.ObjectId;
}

/**
 * Seats a synthetic bot at a practice desk.
 *
 * - The bot gets a fresh ObjectId as userId; no DB User record is created.
 * - balanceAtTable is always PRACTICE_STARTING_CHIPS — never use inline 100000.
 * - Only valid on practice desks (desk.isPractice === true).
 * - Acquires the desk lock internally; never call from inside withDeskLock.
 */
export async function addBotToSeat(input: {
  deskId: string;
  seatNumber: number;
  strategy: BotDifficulty;
}): Promise<AddBotToSeatResult> {
  return withDeskLock(input.deskId, async () => {
    const desk = await PokerDesk.findById(input.deskId);
    if (!desk) throw new NotFoundError('Desk', input.deskId);

    if (!desk.isPractice) {
      throw new InvalidStateError('addBotToSeat is only valid on practice desks');
    }
    if (desk.status === 'closed') {
      throw new InvalidStateError('Desk is closed — cannot seat a bot');
    }
    if (desk.seats.some((s: ISeat) => s.seatNumber === input.seatNumber)) {
      throw new InvalidStateError('SEAT_TAKEN');
    }
    if (desk.seats.length >= desk.maxSeats) {
      throw new InvalidStateError('DESK_FULL');
    }

    const botUserId = new Types.ObjectId();

    desk.seats.push({
      userId: botUserId,
      seatNumber: input.seatNumber,
      buyInAmount: PRACTICE_STARTING_CHIPS,
      balanceAtTable: PRACTICE_STARTING_CHIPS,
      status: 'active',
    } as ISeat);

    await desk.save();

    const botName = `${generateGamerName()}_bot`;
    await Bot.create({
      deskId: desk._id,
      botId: botUserId,
      seatNumber: input.seatNumber,
      strategy: input.strategy,
      botName,
    });

    return { desk, botUserId };
  });
}
