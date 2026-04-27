import { ICard, IPlayer, IPlayerHand, IPot, WPot } from '../utils/pokerTypes';

// Helper functions
const getRankIndex = (rank: string): number => '23456789TJQKA'.indexOf(rank);

const countRanks = (cards: ICard[]): Record<string, number> =>
  cards.reduce((acc, card) => {
    acc[card.rank] = (acc[card.rank] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

const isFlush = (cards: ICard[]): boolean => {
  const suits = cards.map(card => card.suit);
  return suits.every(suit => suit === suits[0]);
};

const isStraight = (cards: ICard[]): boolean => {
  const ranks = cards.map(card => getRankIndex(card.rank)).sort((a, b) => a - b);
  const uniqueRanks = Array.from(new Set(ranks));
  if (uniqueRanks.length === 5 && uniqueRanks[4] - uniqueRanks[0] === 4) return true;
  return uniqueRanks.toString() === '0,1,2,3,12'; // Ace-low straight
};

// Generate all combinations of `k` cards from a given array
const generateCombinations = (cards: ICard[], k: number): ICard[][] => {
  if (k === 0) return [[]];
  if (cards.length === 0) return [];
  const [first, ...rest] = cards;
  const withFirst = generateCombinations(rest, k - 1).map(comb => [first, ...comb]);
  const withoutFirst = generateCombinations(rest, k);
  return [...withFirst, ...withoutFirst];
};

// Get hand ranking
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

// Helper for PLO-style hand evaluation (e.g., PLO4, PLO5)
const getBestFiveCardHandFromCombinations = (holeCards: ICard[], communityCards: ICard[], requiredHoleCards: number) => {
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

// Evaluate hands for each player with game type logic
export const evaluateHands = (players: IPlayer[], communityCards: ICard[], gameType: string): IPlayerHand[] => {
  return players.map(player => {
    if (player.status === 'folded') {
      return { playerId: player.userId, hand: 'folded', handRank: 0, highCard: 0 };
    }

    const allCards = [...player.holeCards, ...communityCards];
    let bestHand;

    switch (gameType) {
      case 'NLH': // No Limit Hold'em
        bestHand = getBestFiveCardHandFromCombinations(player.holeCards, communityCards, 2);
        break;
      case 'PLO4': // Pot Limit Omaha (4 cards)
        bestHand = getBestFiveCardHandFromCombinations(player.holeCards.slice(0, 4), communityCards, 2);
        break;
      case 'PLO5': // Pot Limit Omaha (5 cards)
        bestHand = getBestFiveCardHandFromCombinations(player.holeCards.slice(0, 5), communityCards, 2);
        break;
      // Add more game types here
      default:
        throw new Error(`Unsupported game type: ${gameType}`);
    }

    return {
      playerId: player.userId,
      hand: bestHand.hand,
      handRank: bestHand.rank,
      highCard: bestHand.highCard,
    };
  });
};

// Evaluate pots and determine winners
export const evaluatePots = (players: IPlayer[], communityCards: ICard[], pots: WPot[], gameType: string): IPot[] => {
  const playerHands = evaluateHands(players, communityCards, gameType);

  return pots.map(pot => {
    const eligibleHands = playerHands.filter(hand =>
      pot.contributors.some(contributor =>
        contributor.playerId === hand.playerId.toString() && hand.hand !== 'folded'
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
