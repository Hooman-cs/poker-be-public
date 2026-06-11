import type { IPokerGame, ICard } from '@/models/pokerDesk';
import { Types } from 'mongoose';
import type { BotDifficulty } from '@/config/constants';
import { Hand } from 'pokersolver';

export interface BotAction {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  amount?: number; // minor units; required for raise only
}

export interface BotStrategy {
  selectAction(game: IPokerGame, botUserId: Types.ObjectId): BotAction;
}

// Mirrors engine's calculateCallAmount — uses current round's actions only,
// so it correctly returns 0 when no one has bet in the new round.
function calcCallAmount(game: IPokerGame, playerId: Types.ObjectId): number {
  const round = game.rounds.at(-1);
  if (!round) return 0;
  let maxBet = 0;
  const bets: Record<string, number> = {};
  for (const act of round.actions) {
    const key = act.userId.toString();
    bets[key] = (bets[key] ?? 0) + act.amount;
    if (bets[key] > maxBet) maxBet = bets[key];
  }
  return Math.max(0, maxBet - (bets[playerId.toString()] ?? 0));
}

class AdaptiveStrategy implements BotStrategy {
  selectAction(game: IPokerGame, botUserId: Types.ObjectId): BotAction {
    const player = game.players.find((p) => p.userId.equals(botUserId));
    if (!player) return { action: 'fold' };

    const callAmount = calcCallAmount(game, player.userId);
    const canCheck = callAmount <= 0;
    const communityCards = game.communityCards ?? [];

    const strength = communityCards.length >= 3
      ? this.postFlopStrength(player.holeCards, communityCards)
      : this.preFlopStrength(player.holeCards);

    // Add variance — jitter strength by ±1 so same cards play differently
    const jitter = (Math.random() * 2 - 1);
    const effectiveStrength = Math.max(0, Math.min(10, strength + jitter));

    // Bluff: 12% chance to raise regardless of hand
    const isBluffing = Math.random() < 0.12;

    if (isBluffing && player.balanceAtTable > callAmount) {
      const potTotal = game.pots.reduce((s, p) => s + p.amount, 0);
      const raiseAmt = Math.max(callAmount * 2, Math.floor(potTotal * 0.6));
      if (raiseAmt < player.balanceAtTable) {
        return { action: 'raise', amount: raiseAmt };
      }
    }

    // Strong hand: raise
    if (effectiveStrength >= 7.5) {
      const potTotal = game.pots.reduce((s, p) => s + p.amount, 0);
      const raiseAmt = Math.max(callAmount * 2, Math.floor(potTotal * 0.75));
      if (raiseAmt < player.balanceAtTable) {
        return { action: 'raise', amount: raiseAmt };
      }
      return { action: 'call' };
    }

    // Decent hand: call
    if (effectiveStrength >= 4.5) {
      if (canCheck) return { action: 'check' };
      return { action: 'call' };
    }

    // Weak hand: check if free, fold to bets (25% bluff-call)
    if (canCheck) return { action: 'check' };
    if (Math.random() < 0.25) return { action: 'call' };
    return { action: 'fold' };
  }

  private preFlopStrength(holeCards: ICard[]): number {
    if (!holeCards || holeCards.length < 2) return 2;
    const rankOrder = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const r0 = rankOrder.indexOf(holeCards[0].rank);
    const r1 = rankOrder.indexOf(holeCards[1].rank);
    const high = Math.max(r0, r1);
    const low = Math.min(r0, r1);
    const isPair = r0 === r1;
    const isSuited = holeCards[0].suit === holeCards[1].suit;
    const gap = high - low;

    if (isPair) {
      if (high >= 12) return 10; // AA
      if (high >= 11) return 9;  // KK
      if (high >= 10) return 8;  // QQ
      if (high >= 8)  return 7;  // JJ/TT
      if (high >= 5)  return 5;  // 77-99
      return 4;                  // 22-66
    }
    if (high === 12) { // Ace-x
      if (low >= 11) return 9;   // AK
      if (low >= 10) return 8;   // AQ
      if (low >= 9)  return 7;   // AJ
      if (low >= 8)  return 6;   // AT
      return isSuited ? 5 : 3;
    }
    if (high === 11 && low >= 10) return isSuited ? 7 : 6; // KQ/KQs
    if (gap <= 1 && isSuited && high >= 8) return 6; // suited connectors
    if (gap <= 1 && high >= 10) return 5;             // offsuit connectors
    return isSuited ? 3 : 2;                          // weak hands
  }

  private postFlopStrength(holeCards: ICard[], communityCards: ICard[]): number {
    if (!holeCards || holeCards.length < 2) return 2;
    try {
      // pokersolver notation: rank + first letter of suit (Ah, Ks, Qd, Jc)
      const toPS = (c: ICard) => `${c.rank}${c.suit[0]}`;
      const cards = [...holeCards, ...communityCards].map(toPS);
      const hand = Hand.solve(cards);
      // hand.rank: 0=high card, 1=pair, 2=two pair, 3=trips,
      //            4=straight, 5=flush, 6=full house, 7=quads, 8=str flush
      const rankMap: Record<number, number> = {
        0: 2, 1: 4, 2: 5.5, 3: 7, 4: 7.5, 5: 8, 6: 8.5, 7: 9.5, 8: 10,
      };
      return rankMap[hand.rank] ?? 2;
    } catch {
      return 3;
    }
  }
}

export function getBotStrategy(_difficulty: BotDifficulty): BotStrategy {
  return new AdaptiveStrategy();
}
