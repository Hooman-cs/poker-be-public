/**
 * @fileoverview Pot Calculator
 * Builds the main pot and side pots from a hand's betting rounds. Correctly
 * isolates "dead money" (contributions from folded players) and resolves
 * all-in scenarios mathematically. WPot is defined here and consumed by
 * handEvaluator.ts during winner determination.
 *
 * All amounts are INTEGER minor units. With float money gone, the rounding
 * helpers from the previous version (`sanitizeMath`) are no longer needed —
 * integer math is exact by definition.
 */

import { IRound, IPlayerActionRecord } from '@/models/pokerDesk';

export interface PlayerBet {
  /** Total contributed across all rounds, minor units. */
  amount: number;
  lastAction: IPlayerActionRecord['action'] | '';
}

export interface WPot {
  /** Pot size, minor units. */
  amount: number;
  contributors: {
    playerId: string;
    /** Contribution to this pot, minor units. */
    contribution: number;
  }[];
}

/**
 * Sums every action across every round into a single total per player, and
 * remembers each player's final action (used downstream to identify folds).
 */
export function aggregateBetsFromRounds(
  rounds: IRound[]
): Record<string, PlayerBet> {
  const totalBets: Record<string, PlayerBet> = {};

  for (const round of rounds) {
    for (const action of round.actions) {
      const playerId = action.userId.toString();

      if (!totalBets[playerId]) {
        totalBets[playerId] = { amount: 0, lastAction: '' };
      }

      totalBets[playerId].amount += action.amount;
      totalBets[playerId].lastAction = action.action;
    }
  }

  return totalBets;
}

/**
 * Splits all chips wagered in the hand into a main pot and (if needed) side
 * pots. Returns pots in order: index 0 is the main pot, then progressively
 * smaller side pots created by all-ins.
 *
 * Algorithm: repeatedly find the smallest remaining contribution among
 * still-eligible (non-folded) players, take that amount from every player who
 * has it, accumulate into the current pot, deduct it, and loop. Folded
 * players contribute their money but cannot be eligible to win it.
 */
export function calculatePots(rounds: IRound[]): WPot[] {
  const pots: WPot[] = [];
  const totalBets = aggregateBetsFromRounds(rounds);

  while (true) {
    const playersWithMoney = Object.keys(totalBets).filter(
      (playerId) => totalBets[playerId].amount > 0
    );
    if (playersWithMoney.length === 0) break;

    const eligibleContributors = playersWithMoney.filter(
      (playerId) => totalBets[playerId].lastAction !== 'fold'
    );
    if (eligibleContributors.length === 0) break;

    const minBet = Math.min(
      ...eligibleContributors.map((p) => totalBets[p].amount)
    );

    const pot: WPot = { amount: 0, contributors: [] };

    for (const playerId of playersWithMoney) {
      const contribution = Math.min(totalBets[playerId].amount, minBet);

      if (contribution > 0) {
        pot.amount += contribution;
        pot.contributors.push({ playerId, contribution });
        totalBets[playerId].amount -= contribution;
      }
    }

    if (pot.amount > 0) {
      pots.push(pot);
    }
  }

  return pots;
}