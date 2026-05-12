/**
 * @fileoverview Poker hand evaluation engine.
 * Contains algorithmic logic for determining hand strength and distributing pots.
 */

import { ICard, IPlayer, IPot, WPot, IPlayerHand } from './pokerModelTypes'; 

// -----------------------------------------------------------------------------
// Core Hand Evaluation Helpers
// -----------------------------------------------------------------------------

// FIX: Array map prevents the string parsing bug where '10' returns -1
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * Gets the mathematical index of a card rank for evaluation comparisons.
 * @param rank - The rank of the card (e.g., '10', 'A')
 * @returns The mathematical index of the rank
 */
const getRankIndex = (rank: string): number => RANKS.indexOf(rank);

/**
 * Counts the occurrences of each rank in a given set of cards.
 * @param cards - Array of cards to count
 * @returns A record mapping card ranks to their count
 */
const countRanks = (cards: ICard[]): Record<string, number> =>
  cards.reduce((acc, card) => {
    acc[card.rank] = (acc[card.rank] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

/**
 * Determines if all given cards share the same suit.
 * @param cards - Array of cards to check
 * @returns True if all cards are of the same suit
 */
const isFlush = (cards: ICard[]): boolean => {
  if (cards.length === 0) return false;
  const firstSuit = cards[0].suit;
  return cards.every(card => card.suit === firstSuit);
};

/**
 * Determines if the given cards form a sequential straight.
 * @param cards - Array of cards to check
 * @returns True if the cards form a straight
 */
const isStraight = (cards: ICard[]): boolean => {
  const ranks = cards.map(card => getRankIndex(card.rank)).sort((a, b) => a - b);
  const uniqueRanks = Array.from(new Set(ranks));
  
  if (uniqueRanks.length >= 5) {
    if (uniqueRanks[4] - uniqueRanks[0] === 4) return true;
    // Ace-low straight check (A, 2, 3, 4, 5 maps to indices 12, 0, 1, 2, 3)
    if (uniqueRanks.join(',') === '0,1,2,3,12') return true;
  }
  return false;
};

/**
 * Generates all mathematical combinations of `k` cards from a given array.
 * @param cards - The pool of available cards
 * @param k - The number of cards to choose
 * @returns An array of card combinations
 */
const generateCombinations = (cards: ICard[], k: number): ICard[][] => {
  if (k === 0) return [[]];
  if (cards.length === 0) return [];
  const [first, ...rest] = cards;
  const withFirst = generateCombinations(rest, k - 1).map(comb => [first, ...comb]);
  const withoutFirst = generateCombinations(rest, k);
  return [...withFirst, ...withoutFirst];
};

// -----------------------------------------------------------------------------
// Hand Ranking Engine
// -----------------------------------------------------------------------------

/**
 * Evaluates a strict 5-card array and returns its mathematical rank and high card.
 * @param cards - Exactly 5 cards to evaluate
 * @returns The hand ranking details
 */
export const getHandRanking = (cards: ICard[]): { hand: string; rank: number; highCard: number } => {
  const rankCount = countRanks(cards);
  const counts = Object.values(rankCount).sort((a, b) => b - a);
  const highestCard = Math.max(...cards.map(card => getRankIndex(card.rank)));

  const flush = isFlush(cards);
  const straight = isStraight(cards);

  if (flush && straight && highestCard === getRankIndex('A')) return { hand: 'royal-flush', rank: 10, highCard: highestCard };
  if (flush && straight) return { hand: 'straight-flush', rank: 9, highCard: highestCard };
  if (counts[0] === 4) return { hand: 'four-of-a-kind', rank: 8, highCard: highestCard };
  if (counts[0] === 3 && counts[1] === 2) return { hand: 'full-house', rank: 7, highCard: highestCard };
  if (flush) return { hand: 'flush', rank: 6, highCard: highestCard };
  if (straight) return { hand: 'straight', rank: 5, highCard: highestCard };
  if (counts[0] === 3) return { hand: 'three-of-a-kind', rank: 4, highCard: highestCard };
  if (counts[0] === 2 && counts[1] === 2) return { hand: 'two-pair', rank: 3, highCard: highestCard };
  if (counts[0] === 2) return { hand: 'one-pair', rank: 2, highCard: highestCard };

  return { hand: 'high-card', rank: 1, highCard: highestCard };
};

// -----------------------------------------------------------------------------
// Game Type Specific Evaluators
// -----------------------------------------------------------------------------

/**
 * Helper for PLO-style hand evaluation.
 * Enforces the rule that players MUST use exactly X hole cards and Y community cards.
 */
const getBestPLOHand = (holeCards: ICard[], communityCards: ICard[], requiredHoleCards: number) => {
  const combinations = generateCombinations(holeCards, requiredHoleCards)
    .flatMap(holeCombo =>
      generateCombinations(communityCards, 5 - requiredHoleCards)
        .map(communityCombo => [...holeCombo, ...communityCombo])
    );

  return combinations.reduce((best, current) => {
    const hand = getHandRanking(current);
    return hand.rank > best.rank || (hand.rank === best.rank && hand.highCard > best.highCard) ? hand : best;
  }, { hand: '', rank: 0, highCard: 0 });
};

/**
 * Helper for Texas Hold'em (NLH) hand evaluation.
 * Evaluates the absolute best 5-card combination from all 7 available cards.
 */
const getBestNLHHand = (holeCards: ICard[], communityCards: ICard[]) => {
  const allCards = [...holeCards, ...communityCards];
  const combinations = generateCombinations(allCards, 5);

  return combinations.reduce((best, current) => {
    const hand = getHandRanking(current);
    return hand.rank > best.rank || (hand.rank === best.rank && hand.highCard > best.highCard) ? hand : best;
  }, { hand: '', rank: 0, highCard: 0 });
};

// -----------------------------------------------------------------------------
// Main Evaluation Exports
// -----------------------------------------------------------------------------

/**
 * Evaluates the best possible hand for all players based on the active game type.
 * @param players - Array of players with their hole cards
 * @param communityCards - Array of community cards on the board
 * @param gameType - The type of poker game (e.g., 'NLH', 'PLO4')
 * @returns Array of evaluated player hands
 */
export const evaluateHands = (players: IPlayer[], communityCards: ICard[], gameType: string): IPlayerHand[] => {
  return players.map(player => {
    if (player.status === 'folded') {
      return { playerId: player.userId, hand: 'folded', handRank: 0, highCard: 0 };
    }

    let bestHand;

    switch (gameType) {
      case 'NLH': 
        bestHand = getBestNLHHand(player.holeCards, communityCards);
        break;
      case 'PLO4': 
        bestHand = getBestPLOHand(player.holeCards.slice(0, 4), communityCards, 2);
        break;
      case 'PLO5': 
        bestHand = getBestPLOHand(player.holeCards.slice(0, 5), communityCards, 2);
        break;
      default:
        // Fail-safe gracefully falls back to NLH if an unknown mode is passed
        console.warn(`[Game Engine]: Unsupported game type ${gameType}. Defaulting to NLH rules.`);
        bestHand = getBestNLHHand(player.holeCards, communityCards);
        break;
    }

    return {
      playerId: player.userId,
      hand: bestHand.hand,
      handRank: bestHand.rank,
      highCard: bestHand.highCard,
    };
  });
};

/**
 * Iterates through all pots (main and side) and distributes winners mathematically.
 * @param players - Array of players
 * @param communityCards - Array of community cards on the board
 * @param pots - Array of working pots (WPot) to evaluate
 * @param gameType - The type of poker game
 * @returns Array of finalized pots (IPot) with winner distributions
 */
export const evaluatePots = (players: IPlayer[], communityCards: ICard[], pots: WPot[], gameType: string): IPot[] => {
  const playerHands = evaluateHands(players, communityCards, gameType);

  return pots.map(pot => {
    const eligibleHands = playerHands.filter(hand =>
      pot.contributors.some((contributor) =>
        contributor.playerId.toString() === hand.playerId.toString() && hand.hand !== 'folded'
      )
    );

    if (eligibleHands.length === 0) {
      return { amount: pot.amount, contributors: pot.contributors, winners: [] };
    }

    const sortedHands = eligibleHands.sort((a, b) =>
      b.handRank - a.handRank || b.highCard - a.highCard
    );

    const topRanking = sortedHands[0];
    const topWinners = sortedHands.filter(hand =>
      hand.handRank === topRanking.handRank && hand.highCard === topRanking.highCard
    );

    const individualShare = pot.amount / topWinners.length;
    const winners = topWinners.map(winner => ({
      playerId: winner.playerId,
      amount: individualShare,
    }));

    return {
      amount: pot.amount,
      contributors: pot.contributors,
      winners,
    };
  });
};