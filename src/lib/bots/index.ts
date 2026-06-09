import type { IPokerGame, IGamePlayer } from '@/models/pokerDesk';
import { Types } from 'mongoose';
import type { BotDifficulty } from '@/config/constants';

export interface BotAction {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  amount?: number; // minor units; required for raise only
}

export interface BotStrategy {
  selectAction(game: IPokerGame, botUserId: Types.ObjectId): BotAction;
}

function getPlayer(game: IPokerGame, botUserId: Types.ObjectId): IGamePlayer | undefined {
  return game.players.find((p) => p.userId.equals(botUserId));
}

function totalPotAmount(game: IPokerGame): number {
  return game.rounds.reduce(
    (sum, round) => sum + round.actions.reduce((s, a) => s + a.amount, 0),
    0
  );
}

function hasPair(player: IGamePlayer): boolean {
  return (
    player.holeCards.length >= 2 &&
    player.holeCards[0].rank === player.holeCards[1].rank
  );
}

// Never raises. Checks when free; calls if affordable; folds if not.
class EasyStrategy implements BotStrategy {
  selectAction(game: IPokerGame, botUserId: Types.ObjectId): BotAction {
    const player = getPlayer(game, botUserId);
    if (!player) return { action: 'fold' };

    const callAmount = game.totalBet - player.totalBet;
    if (callAmount <= 0) return { action: 'check' };
    if (player.balanceAtTable < callAmount) return { action: 'fold' };
    return { action: 'call' };
  }
}

// Pot-odds aware. Raises on a pair; calls when pot odds are favourable; folds otherwise.
class MediumStrategy implements BotStrategy {
  selectAction(game: IPokerGame, botUserId: Types.ObjectId): BotAction {
    const player = getPlayer(game, botUserId);
    if (!player) return { action: 'fold' };

    const callAmount = game.totalBet - player.totalBet;
    if (callAmount <= 0) return { action: 'check' };

    const pot = totalPotAmount(game);
    const potOdds = callAmount / (pot + callAmount);
    const pair = hasPair(player);

    if (pair) {
      const raiseAmount = Math.floor(pot * 0.75);
      if (raiseAmount > 0 && player.balanceAtTable >= raiseAmount) {
        return { action: 'raise', amount: raiseAmount };
      }
      return { action: 'call' };
    }

    if (potOdds < 0.35) return { action: 'call' };
    return { action: 'fold' };
  }
}

// Position-aware medium. Tight in early position; aggressive in late position with a pair.
class HardStrategy implements BotStrategy {
  selectAction(game: IPokerGame, botUserId: Types.ObjectId): BotAction {
    const player = getPlayer(game, botUserId);
    if (!player) return { action: 'fold' };

    const callAmount = game.totalBet - player.totalBet;
    if (callAmount <= 0) return { action: 'check' };

    const pot = totalPotAmount(game);
    const potOdds = callAmount / (pot + callAmount);
    const pair = hasPair(player);

    // Late position = more than half the active players have already acted this round.
    const currentRound = game.rounds.at(-1);
    const activePlayers = game.players.filter(
      (p) => p.status === 'active' || p.status === 'all-in'
    ).length;
    const actionsThisRound = currentRound?.actions.length ?? 0;
    const isLatePosition = actionsThisRound >= Math.ceil(activePlayers / 2);

    if (isLatePosition && pair) {
      const raiseAmount = Math.floor(pot * 1.0);
      if (raiseAmount > 0 && player.balanceAtTable >= raiseAmount) {
        return { action: 'raise', amount: raiseAmount };
      }
      return { action: 'call' };
    }

    const callThreshold = isLatePosition ? 0.35 : 0.25;
    if (potOdds < callThreshold) return { action: 'call' };
    return { action: 'fold' };
  }
}

export function getBotStrategy(difficulty: BotDifficulty): BotStrategy {
  switch (difficulty) {
    case 'easy':   return new EasyStrategy();
    case 'medium': return new MediumStrategy();
    case 'hard':   return new HardStrategy();
  }
}
