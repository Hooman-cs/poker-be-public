import { ICard, IPlayer, IPlayerHand, IPot, ISidePot,WPot } from '../utils/pokerTypes';

// Helper functions for hand evaluation
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

// Evaluate hands for each player
export const evaluateHands = (players: IPlayer[], communityCards: ICard[]): IPlayerHand[] => {
  return players.map(player => {
    if (player.status === 'folded') {
      return { playerId: player.userId, hand: 'folded', handRank: 0, highCard: 0 }; // Folded players cannot win
    }
    const allCards = [...player.holeCards, ...communityCards];
    const { hand, rank, highCard } = getHandRanking(allCards);
    return { playerId: player.userId, hand, handRank: rank, highCard };
  });
};

// Determine winners based on hand rankings
const determineWinners = (playerHands: IPlayerHand[], sidePot: ISidePot): string[] => {
  const eligibleHands = playerHands.filter(hand => sidePot.players.includes(hand.playerId) && hand.hand !== 'folded');
  const sortedHands = eligibleHands.sort((a, b) => b.handRank - a.handRank || b.highCard - a.highCard);
  return sortedHands.map(hand => hand.playerId); // Returns sorted player IDs based on their ranking
};

export const evaluatePots = (players: IPlayer[], communityCards: ICard[], pots: WPot[]): IPot[] => {
  const playerHands = evaluateHands(players, communityCards);
  const evaluatedPots: IPot[] = pots.map(pot => {

    
    const eligibleHands = playerHands.filter(hand => {
      return pot.contributors.some(contributor => {
        return contributor.playerId === hand.playerId.toString() && hand.hand !== 'folded';
      });
    }); 

    // If no eligible hands, return pot without winners
    if (eligibleHands.length === 0) {
      return {
        amount: pot.amount,
        contributors: pot.contributors,
        winners: []
      };
    }

    // Sort hands by hand rank and high card to determine winners
    const sortedHands = eligibleHands.sort((a, b) =>
      b.handRank - a.handRank || b.highCard - a.highCard
    );

    // Determine the top-ranked hand(s) for the current pot
    const topRanking = sortedHands[0];
    const topWinners = sortedHands.filter(hand =>
      hand.handRank === topRanking.handRank && hand.highCard === topRanking.highCard
    );

    // Calculate the winning share for each top winner
    const individualShare = pot.amount / topWinners.length;

    // Create the winners array with playerId and amount for each top winner
    const winners = topWinners.map(winner => ({
      playerId: winner.playerId,
      amount: individualShare
    }));

    // Return the IPot structure with updated winners
    return {
      amount: pot.amount, // Total pot amount
      contributors: pot.contributors, // Contributors remain the same
      winners, // Winners with their winning amounts
    };
  });

  return evaluatedPots; // Return the updated pots as IPot[]
};





