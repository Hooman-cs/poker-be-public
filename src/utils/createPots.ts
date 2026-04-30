
/**
 * @fileoverview Core Poker Pot Calculation Engine
 * Handles main pot and side pot generation, isolating dead money,
 * and resolving all-in scenarios mathematically.
 */

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export type PlayerActionType = 'fold' | 'call' | 'raise' | 'all-in' | 'check' | 'bet' | 'small-blind' | 'big-blind';

export interface RoundAction {
  userId: string;
  amount: number;
  action: PlayerActionType;
}

export interface Round {
  actions: RoundAction[];
}

export interface PlayerBet {
  amount: number;
  lastAction: PlayerActionType | '';
}

export interface PotContributor {
  playerId: string;
  contribution: number;
}

export interface Pot {
  amount: number;
  contributors: PotContributor[];
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Normalizes floating-point numbers to prevent JS precision bugs (e.g., 0.1 + 0.2).
 * Rounds to 2 decimal places (cents). If you use lowest-denomination integers, this is a safety net.
 */
const sanitizeMath = (num: number): number => {
  return Math.round(num * 100) / 100;
};

// -----------------------------------------------------------------------------
// Core Engine
// -----------------------------------------------------------------------------

/**
 * Aggregates all bets across all rounds into a single total per user.
 * * @param {Round[]} rounds - The array of betting rounds.
 * @returns {Record<string, PlayerBet>} Map of user IDs to their total contribution and final status.
 */
export const convertRoundsToTotalBets = (rounds: Round[]): Record<string, PlayerBet> => {
  const totalBets: Record<string, PlayerBet> = {};

  rounds.forEach((round) => {
    round.actions.forEach((action) => {
      const { userId, amount, action: playerAction } = action;

      if (!totalBets[userId]) {
        totalBets[userId] = { amount: 0, lastAction: '' };
      }

      totalBets[userId].amount = sanitizeMath(totalBets[userId].amount + amount);
      totalBets[userId].lastAction = playerAction;
    });
  });

  return totalBets;
};

/**
 * Calculates the main pot and side pots correctly based on all-ins and folds.
 * * @param {Round[]} rounds - The array of betting rounds.
 * @returns {Pot[]} An array of generated pots. Index 0 is the main pot, subsequent indexes are side pots.
 */
export const createPots = (rounds: Round[]): Pot[] => {
  const pots: Pot[] = [];
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
    // (This handles cases where everyone else folded)
    if (activePlayers.length === 0) break; 

    // 3. Find the cap (bounding amount) for the current pot.
    // The cap is the smallest bet amount among ACTIVE players.
    const currentPotCap = Math.min(
      ...activePlayers.map((player) => totalBets[player].amount)
    );

    const currentPot: Pot = { amount: 0, contributors: [] };

    // 4. Extract money from all players for this pot up to the cap
    playersWithMoney.forEach((player) => {
      const playerState = totalBets[player];
      
      // A player contributes either the cap, or their remaining balance (whichever is smaller)
      const contribution = Math.min(playerState.amount, currentPotCap);

      if (contribution > 0) {
        currentPot.amount = sanitizeMath(currentPot.amount + contribution);
        currentPot.contributors.push({
          playerId: player,
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