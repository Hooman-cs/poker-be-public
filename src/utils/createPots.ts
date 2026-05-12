/**
 * @fileoverview Core Poker Pot Calculation Engine
 * Handles main pot and side pot generation, isolating dead money,
 * and resolving all-in scenarios mathematically.
 */

import { IRound, WPot, PlayerAction } from './pokerModelTypes';

// -----------------------------------------------------------------------------
// Internal Accumulator Types
// -----------------------------------------------------------------------------

/**
 * Tracks the running total of a player's bets and their final action.
 * Kept local as it is only used internally by the pot calculation engine.
 */
export interface PlayerBet {
  amount: number;
  lastAction: PlayerAction | '';
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Normalizes floating-point numbers to prevent JS precision bugs (e.g., 0.1 + 0.2).
 * Rounds to 2 decimal places (cents).
 * @param num - The raw floating-point number.
 * @returns The mathematically sanitized number.
 */
const sanitizeMath = (num: number): number => {
  return Math.round(num * 100) / 100;
};

// -----------------------------------------------------------------------------
// Core Engine
// -----------------------------------------------------------------------------

/**
 * Aggregates all bets across all rounds into a single total per user.
 * 
 * @param rounds - The array of strictly typed betting rounds.
 * @returns Map of user IDs (as strings) to their total contribution and final status.
 */
export const convertRoundsToTotalBets = (rounds: IRound[]): Record<string, PlayerBet> => {
  const totalBets: Record<string, PlayerBet> = {};

  rounds.forEach((round) => {
    round.actions.forEach((action) => {
      // Cast ObjectId to string to prevent dictionary key reference bugs
      const userIdStr = action.userId.toString();
      const { amount, action: playerAction } = action;

      if (!totalBets[userIdStr]) {
        totalBets[userIdStr] = { amount: 0, lastAction: '' };
      }

      totalBets[userIdStr].amount = sanitizeMath(totalBets[userIdStr].amount + amount);
      totalBets[userIdStr].lastAction = playerAction;
    });
  });

  return totalBets;
};

/**
 * Calculates the main pot and side pots correctly based on all-ins and folds.
 * 
 * @param rounds - The array of strictly typed betting rounds.
 * @returns An array of generated working pots (WPot). Index 0 is the main pot.
 */
export const createPots = (rounds: IRound[]): WPot[] => {
  const pots: WPot[] = [];
  const totalBets = convertRoundsToTotalBets(rounds);

  while (true) {
    // 1. Identify all players who still have money to be allocated into a pot
    const playersWithMoney = Object.keys(totalBets).filter(
      (player) => totalBets[player].amount > 0
    );

    // If no one has money left to process, we are done calculating pots
    if (playersWithMoney.length === 0) break;

    // 2. Identify active players (not folded). Folded players cannot dictate the size of a pot.
    const activePlayers = playersWithMoney.filter(
      (player) => totalBets[player].lastAction !== 'fold'
    );

    // If there is 1 or 0 active players, any remaining money goes into a final pot
    if (activePlayers.length === 0) break; 

    // 3. Find the cap (bounding amount) for the current pot.
    // The cap is the smallest bet amount among ACTIVE players.
    const currentPotCap = Math.min(
      ...activePlayers.map((player) => totalBets[player].amount)
    );

    const currentPot: WPot = { amount: 0, contributors: [] };

    // 4. Extract money from all players for this pot up to the cap
    playersWithMoney.forEach((player) => {
      const playerState = totalBets[player];
      
      // A player contributes either the cap, or their remaining balance (whichever is smaller)
      const contribution = Math.min(playerState.amount, currentPotCap);

      if (contribution > 0) {
        currentPot.amount = sanitizeMath(currentPot.amount + contribution);
        currentPot.contributors.push({
          playerId: player, // Player ID is already a string from Object.keys
          contribution: contribution,
        });

        // Deduct the contribution from the player's remaining un-potted amount
        playerState.amount = sanitizeMath(playerState.amount - contribution);
      }
    });

    pots.push(currentPot);
  }

  return pots;
};