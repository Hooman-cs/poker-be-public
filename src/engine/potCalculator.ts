/**
 * @fileoverview Pot Calculator
 * Handles main pot and side pot generation from betting rounds.
 * Correctly isolates dead money and resolves all-in scenarios mathematically.
 * WPot is defined here and exported for use by handEvaluator.ts.
 */

import { IRound, IPlayerActionRecord } from '@/models/pokerDesk';

export interface PlayerBet {
  amount: number;
  lastAction: IPlayerActionRecord['action'] | '';
}

export interface WPot {
  amount: number;
  contributors: {
    playerId: string;
    contribution: number;
  }[];
}

/**
 * Normalizes floating-point numbers to prevent JS precision bugs.
 * Rounds to 2 decimal places.
 */
function sanitizeMath(num: number): number {
  return Math.round(num * 100) / 100;
}

/**
 * Aggregates all bets across all rounds into a single total per player.
 * Folds are tracked to identify dead money correctly.
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

      totalBets[playerId].amount = sanitizeMath(
        totalBets[playerId].amount + action.amount
      );
      totalBets[playerId].lastAction = action.action;
    }
  }

  return totalBets;
}

/**
 * Calculates the main pot and all side pots from a set of betting rounds.
 * Handles all-in players and folded dead money correctly.
 * Returns an array of WPot — index 0 is always the main pot.
 *
 * Algorithm:
 * 1. Aggregate total bets per player across all rounds
 * 2. Each iteration finds the smallest all-in amount among active contributors
 * 3. Every player contributes up to that amount into the current pot
 * 4. Folded players contribute their money but cannot win
 * 5. Repeat until all money is allocated
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

    const minBet = sanitizeMath(
      Math.min(...eligibleContributors.map((p) => totalBets[p].amount))
    );

    const pot: WPot = {
      amount: 0,
      contributors: [],
    };

    for (const playerId of playersWithMoney) {
      const contribution = sanitizeMath(
        Math.min(totalBets[playerId].amount, minBet)
      );

      if (contribution > 0) {
        pot.amount = sanitizeMath(pot.amount + contribution);
        pot.contributors.push({ playerId, contribution });
        totalBets[playerId].amount = sanitizeMath(
          totalBets[playerId].amount - contribution
        );
      }
    }

    if (pot.amount > 0) {
      pots.push(pot);
    }
  }

  return pots;
}
// /**
//  * @fileoverview Core Poker Pot Calculation Engine
//  * Handles main pot and side pot generation, isolating dead money,
//  * and resolving all-in scenarios mathematically.
//  */

// import { IRound, WPot, PlayerAction } from '../utils/pokerModelTypes';

// // -----------------------------------------------------------------------------
// // Internal Accumulator Types
// // -----------------------------------------------------------------------------

// /**
//  * Tracks the running total of a player's bets and their final action.
//  * Kept local as it is only used internally by the pot calculation engine.
//  */
// export interface PlayerBet {
//   amount: number;
//   lastAction: PlayerAction | '';
// }

// // -----------------------------------------------------------------------------
// // Helpers
// // -----------------------------------------------------------------------------

// /**
//  * Normalizes floating-point numbers to prevent JS precision bugs (e.g., 0.1 + 0.2).
//  * Rounds to 2 decimal places (cents).
//  * @param num - The raw floating-point number.
//  * @returns The mathematically sanitized number.
//  */
// const sanitizeMath = (num: number): number => {
//   return Math.round(num * 100) / 100;
// };

// // -----------------------------------------------------------------------------
// // Core Engine
// // -----------------------------------------------------------------------------

// /**
//  * Aggregates all bets across all rounds into a single total per user.
//  * 
//  * @param rounds - The array of strictly typed betting rounds.
//  * @returns Map of user IDs (as strings) to their total contribution and final status.
//  */
// export const convertRoundsToTotalBets = (rounds: IRound[]): Record<string, PlayerBet> => {
//   const totalBets: Record<string, PlayerBet> = {};

//   rounds.forEach((round) => {
//     round.actions.forEach((action) => {
//       // Cast ObjectId to string to prevent dictionary key reference bugs
//       const userIdStr = action.userId.toString();
//       const { amount, action: playerAction } = action;

//       if (!totalBets[userIdStr]) {
//         totalBets[userIdStr] = { amount: 0, lastAction: '' };
//       }

//       totalBets[userIdStr].amount = sanitizeMath(totalBets[userIdStr].amount + amount);
//       totalBets[userIdStr].lastAction = playerAction;
//     });
//   });

//   return totalBets;
// };

// /**
//  * Calculates the main pot and side pots correctly based on all-ins and folds.
//  * 
//  * @param rounds - The array of strictly typed betting rounds.
//  * @returns An array of generated working pots (WPot). Index 0 is the main pot.
//  */
// export const createPots = (rounds: IRound[]): WPot[] => {
//   const pots: WPot[] = [];
//   const totalBets = convertRoundsToTotalBets(rounds);

//   while (true) {
//     // 1. Identify all players who still have money to be allocated into a pot
//     const playersWithMoney = Object.keys(totalBets).filter(
//       (player) => totalBets[player].amount > 0
//     );

//     // If no one has money left to process, we are done calculating pots
//     if (playersWithMoney.length === 0) break;

//     // 2. Identify active players (not folded). Folded players cannot dictate the size of a pot.
//     const activePlayers = playersWithMoney.filter(
//       (player) => totalBets[player].lastAction !== 'fold'
//     );

//     // If there is 1 or 0 active players, any remaining money goes into a final pot
//     if (activePlayers.length === 0) break; 

//     // 3. Find the cap (bounding amount) for the current pot.
//     // The cap is the smallest bet amount among ACTIVE players.
//     const currentPotCap = Math.min(
//       ...activePlayers.map((player) => totalBets[player].amount)
//     );

//     const currentPot: WPot = { amount: 0, contributors: [] };

//     // 4. Extract money from all players for this pot up to the cap
//     playersWithMoney.forEach((player) => {
//       const playerState = totalBets[player];
      
//       // A player contributes either the cap, or their remaining balance (whichever is smaller)
//       const contribution = Math.min(playerState.amount, currentPotCap);

//       if (contribution > 0) {
//         currentPot.amount = sanitizeMath(currentPot.amount + contribution);
//         currentPot.contributors.push({
//           playerId: player, // Player ID is already a string from Object.keys
//           contribution: contribution,
//         });

//         // Deduct the contribution from the player's remaining un-potted amount
//         playerState.amount = sanitizeMath(playerState.amount - contribution);
//       }
//     });

//     pots.push(currentPot);
//   }

//   return pots;
// };