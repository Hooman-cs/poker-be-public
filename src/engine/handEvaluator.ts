/**
 * @fileoverview Hand Evaluator
 * Uses pokersolver for battle-tested hand evaluation and winner determination.
 * Custom combination logic handles game-specific card selection rules before
 * passing the best 5 cards to pokersolver for evaluation.
 *
 * Card format conversion:
 * Our format  { suit: 'hearts', rank: '10' }
 * Pokersolver 'Th' (rank + suit initial, 10 becomes T)
 *
 * Supports: Texas Hold'em, Omaha, Seven-Card Stud, Razz, Five-Card Draw
 */

import { Hand } from 'pokersolver';
import { Types } from 'mongoose';
import { IGamePlayer, ICard } from '@/models/pokerDesk';
import { PokerGameType } from '@/models/poker';
import { WPot } from '@/engine/potCalculator';

export interface IEvaluatedPot {
  amount: number;
  contributors: { playerId: string; contribution: number }[];
  winners: { playerId: Types.ObjectId; amount: number }[];
}

const SUIT_MAP: Record<string, string> = {
  hearts: 'h',
  diamonds: 'd',
  clubs: 'c',
  spades: 's',
};

const RANK_MAP: Record<string, string> = {
  '10': 'T',
};

/**
 * Converts our ICard format to pokersolver card string.
 * e.g. { suit: 'hearts', rank: '10' } → 'Th'
 */
function toPokerSolverCard(card: ICard): string {
  const rank = RANK_MAP[card.rank] ?? card.rank;
  const suit = SUIT_MAP[card.suit];
  return `${rank}${suit}`;
}

/**
 * Converts an array of ICard to pokersolver card strings.
 */
function toPokerSolverCards(cards: ICard[]): string[] {
  return cards.map(toPokerSolverCard);
}

/**
 * Generates all k-length combinations from an array.
 */
function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = getCombinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/**
 * Texas Hold'em: pokersolver picks best 5 from all 7 cards.
 */
function solveTexasHoldem(
  holeCards: ICard[],
  communityCards: ICard[]
): ReturnType<typeof Hand.solve> {
  const allCards = toPokerSolverCards([...holeCards, ...communityCards]);
  return Hand.solve(allCards);
}

/**
 * Omaha: must use exactly 2 hole cards and exactly 3 community cards.
 * We generate all valid combinations and pick the best via pokersolver.
 */
function solveOmaha(
  holeCards: ICard[],
  communityCards: ICard[]
): ReturnType<typeof Hand.solve> {
  const holeCombos = getCombinations(holeCards, 2);
  const communityCombos = getCombinations(communityCards, 3);

  let bestHand: ReturnType<typeof Hand.solve> | null = null;

  for (const hole of holeCombos) {
    for (const community of communityCombos) {
      const hand = Hand.solve(toPokerSolverCards([...hole, ...community]));
      if (!bestHand) {
        bestHand = hand;
        continue;
      }
      const winners = Hand.winners([bestHand, hand]);
      if (winners[0] === hand) bestHand = hand;
    }
  }

  return bestHand!;
}

/**
 * Seven-Card Stud: best 5 of 7 hole cards, no community cards.
 * pokersolver picks the best 5 from all 7 automatically.
 */
function solveSevenCardStud(
  holeCards: ICard[]
): ReturnType<typeof Hand.solve> {
  return Hand.solve(toPokerSolverCards(holeCards));
}

/**
 * Five-Card Draw: evaluate exactly 5 hole cards directly.
 */
function solveFiveCardDraw(
  holeCards: ICard[]
): ReturnType<typeof Hand.solve> {
  return Hand.solve(toPokerSolverCards(holeCards));
}

/**
 * Razz: A-5 lowball, best low 5-card hand from 7 hole cards.
 * Straights and flushes do not count against the player.
 * Ace always plays low. Lower hand wins.
 * We invert the score so higher score = better low hand,
 * keeping comparison consistent with Hand.winners.
 *
 * Since pokersolver does not support Razz natively in v2.1.4,
 * we evaluate all 5-card combinations and pick the best low hand manually.
 */

interface IRazzResult {
  score: number;
  cards: ICard[];
  description: string;
}

const RAZZ_RANK_VALUES: Record<string, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9, T: 10,
  J: 11, Q: 12, K: 13,
};

function solveRazz(holeCards: ICard[]): IRazzResult {
  const combos = getCombinations(holeCards, 5);
  let best: IRazzResult | null = null;

  for (const combo of combos) {
    const values = combo
      .map(c => RAZZ_RANK_VALUES[RANK_MAP[c.rank] ?? c.rank])
      .sort((a, b) => b - a);

    const score = -(
      values[0] * 14 ** 4 +
      values[1] * 14 ** 3 +
      values[2] * 14 ** 2 +
      values[3] * 14 +
      values[4]
    );

    if (!best || score > best.score) {
      const topCard = Object.entries(RAZZ_RANK_VALUES).find(
        ([, v]) => v === values[0]
      )?.[0] ?? '?';
      best = {
        score,
        cards: combo,
        description: `${topCard === '1' ? 'A' : topCard}-low`,
      };
    }
  }

  return best!;
}

/**
 * Solves a player's hand for the given game type.
 * Returns a pokersolver Hand object for standard games,
 * or an IRazzResult for Razz.
 */
function solvePlayerHand(
  player: IGamePlayer,
  communityCards: ICard[],
  gameType: PokerGameType
): ReturnType<typeof Hand.solve> | IRazzResult {
  switch (gameType) {
    case "Texas Hold'em":
      return solveTexasHoldem(player.holeCards, communityCards);
    case 'Omaha':
      return solveOmaha(player.holeCards, communityCards);
    case 'Seven-Card Stud':
      return solveSevenCardStud(player.holeCards);
    case 'Five-Card Draw':
      return solveFiveCardDraw(player.holeCards);
    case 'Razz':
      return solveRazz(player.holeCards);
    default:
      console.warn(
        `Unknown game type: ${gameType}. Defaulting to Texas Hold'em.`
      );
      return solveTexasHoldem(player.holeCards, communityCards);
  }
}

/**
 * Determines Razz winners from a set of IRazzResult hands.
 * Higher score = better low hand.
 */
function getRazzWinners(
  hands: { playerId: Types.ObjectId; result: IRazzResult }[]
): Types.ObjectId[] {
  const bestScore = Math.max(...hands.map(h => h.result.score));
  return hands
    .filter(h => h.result.score === bestScore)
    .map(h => h.playerId);
}

/**
 * Evaluates all pots and distributes winnings to correct players.
 * Handles split pots — remainder from division goes to first winner.
 */
export function evaluatePots(
  players: IGamePlayer[],
  communityCards: ICard[],
  pots: WPot[],
  gameType: PokerGameType
): IEvaluatedPot[] {
  const playerMap = new Map<string, IGamePlayer>(
    players.map(p => [p.userId.toString(), p])
  );

  return pots.map(pot => {
    const eligiblePlayers = pot.contributors
      .map(c => playerMap.get(c.playerId))
      .filter(
        (p): p is IGamePlayer =>
          p !== undefined && p.status !== 'folded'
      );

    if (eligiblePlayers.length === 0) {
      return { ...pot, winners: [] };
    }

    if (eligiblePlayers.length === 1) {
      return {
        ...pot,
        winners: [
          { playerId: eligiblePlayers[0].userId, amount: pot.amount },
        ],
      };
    }

    let winnerIds: Types.ObjectId[];

    // if (gameType === 'Razz') {
    //   const razzHands = eligiblePlayers.map(p => ({
    //     playerId: p.userId,
    //     result: solveRazz(p.holeCards),
    //   }));
    //   winnerIds = getRazzWinners(razzHands);
    // } else {
    //   const solvedHands = eligiblePlayers.map(p => ({
    //     playerId: p.userId,
    //     hand: solvePlayerHand(p, communityCards, gameType) as ReturnType
    //       typeof Hand.solve
    //     >,
    //   }));

    //   const winnerHands = Hand.winners(solvedHands.map(h => h.hand));
    //   winnerIds = solvedHands
    //     .filter(h => winnerHands.includes(h.hand))
    //     .map(h => h.playerId);
    // }
    if (gameType === 'Razz') {
  const razzHands = eligiblePlayers.map(p => ({
    playerId: p.userId,
    result: solveRazz(p.holeCards),
  }));
  winnerIds = getRazzWinners(razzHands);
} else {
  const solvedHands = eligiblePlayers.map(p => ({
    playerId: p.userId,
    hand: solvePlayerHand(p, communityCards, gameType) as Hand,
  }));

  const winnerHands = Hand.winners(solvedHands.map(h => h.hand));
  winnerIds = solvedHands
    .filter(h => winnerHands.includes(h.hand))
    .map(h => h.playerId);
}

    const splitAmount =
      Math.floor((pot.amount / winnerIds.length) * 100) / 100;
    const remainder =
      Math.round((pot.amount - splitAmount * winnerIds.length) * 100) / 100;

    const winners = winnerIds.map((id, i) => ({
      playerId: id,
      amount: i === 0 ? splitAmount + remainder : splitAmount,
    }));

    return { ...pot, winners };
  });
}
// /**
//  * @fileoverview Hand Evaluator
//  * Evaluates poker hands and distributes pots to winners.
//  * Supports all 5 game types: Texas Hold'em, Omaha, Seven-Card Stud, Razz, Five-Card Draw.
//  * IPlayerHand and IEvaluatedPot are defined locally — only used in this file.
//  * WPot is imported from potCalculator as it is shared between both engine files.
//  */

// import { Types } from 'mongoose';
// import { IGamePlayer, ICard } from '@/models/pokerDesk';
// import { PokerGameType } from '@/models/poker';
// import { WPot } from '@/engine/potCalculator';

// interface IHandResult {
//   hand: string;
//   rank: number;
//   score: number;
// }

// interface IPlayerHand {
//   playerId: Types.ObjectId;
//   hand: string;
//   handRank: number;
//   score: number;
// }

// export interface IEvaluatedPot {
//   amount: number;
//   contributors: { playerId: string; contribution: number }[];
//   winners: { playerId: Types.ObjectId; amount: number }[];
// }

// const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// const RAZZ_RANK_VALUES: Record<string, number> = {
//   'A': 1, '2': 2, '3': 3, '4': 4, '5': 5,
//   '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
//   'J': 11, 'Q': 12, 'K': 13,
// };

// const RAZZ_RANK_NAMES: Record<number, string> = {
//   1: 'Ace', 2: '2', 3: '3', 4: '4', 5: '5',
//   6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
//   11: 'Jack', 12: 'Queen', 13: 'King',
// };

// const HAND_RANKS = {
//   HIGH_CARD: 1,
//   ONE_PAIR: 2,
//   TWO_PAIR: 3,
//   THREE_OF_A_KIND: 4,
//   STRAIGHT: 5,
//   FLUSH: 6,
//   FULL_HOUSE: 7,
//   FOUR_OF_A_KIND: 8,
//   STRAIGHT_FLUSH: 9,
//   ROYAL_FLUSH: 10,
// } as const;

// /**
//  * Returns the rank index of a card (0 = 2, 12 = A).
//  */
// function getRankIndex(rank: string): number {
//   return RANK_ORDER.indexOf(rank);
// }

// /**
//  * Generates all k-length combinations from an array.
//  */
// function getCombinations<T>(arr: T[], k: number): T[][] {
//   if (k === 0) return [[]];
//   if (arr.length === 0) return [];
//   const [first, ...rest] = arr;
//   const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c]);
//   const withoutFirst = getCombinations(rest, k);
//   return [...withFirst, ...withoutFirst];
// }

// /**
//  * Counts occurrences of each rank in a set of cards.
//  */
// function countRanks(cards: ICard[]): Record<string, number> {
//   return cards.reduce((acc, card) => {
//     acc[card.rank] = (acc[card.rank] || 0) + 1;
//     return acc;
//   }, {} as Record<string, number>);
// }

// /**
//  * Returns true if all cards share the same suit.
//  */
// function isFlush(cards: ICard[]): boolean {
//   if (cards.length === 0) return false;
//   return cards.every(c => c.suit === cards[0].suit);
// }

// /**
//  * Returns true if the cards form a sequential straight.
//  * Handles ace-low straight (A-2-3-4-5).
//  */
// function isStraight(cards: ICard[]): boolean {
//   const indices = [...new Set(cards.map(c => getRankIndex(c.rank)))].sort(
//     (a, b) => a - b
//   );
//   if (indices.length < 5) return false;
//   if (indices[4] - indices[0] === 4) return true;

//   // Ace-low straight: A(12), 2(0), 3(1), 4(2), 5(3)
//   return (
//     indices[0] === 0 &&
//     indices[1] === 1 &&
//     indices[2] === 2 &&
//     indices[3] === 3 &&
//     indices[4] === 12
//   );
// }

// /**
//  * Computes a composite tiebreaker score for a 5-card hand.
//  * Cards are sorted by frequency (desc) then by rank index (desc).
//  * Higher score wins ties within the same hand rank.
//  */
// function computeScore(cards: ICard[]): number {
//   const rankCounts = countRanks(cards);
//   const sorted = [...cards].sort((a, b) => {
//     const countDiff =
//       (rankCounts[b.rank] || 0) - (rankCounts[a.rank] || 0);
//     if (countDiff !== 0) return countDiff;
//     return getRankIndex(b.rank) - getRankIndex(a.rank);
//   });
//   return sorted.reduce(
//     (score, card, i) => score + getRankIndex(card.rank) * Math.pow(13, 4 - i),
//     0
//   );
// }

// /**
//  * Evaluates a strict 5-card hand and returns its rank and tiebreaker score.
//  */
// function evaluate5Cards(cards: ICard[]): IHandResult {
//   const rankCounts = countRanks(cards);
//   const counts = Object.values(rankCounts).sort((a, b) => b - a);
//   const flush = isFlush(cards);
//   const straight = isStraight(cards);
//   const score = computeScore(cards);

//   if (flush && straight) {
//     const indices = cards.map(c => getRankIndex(c.rank)).sort((a, b) => a - b);
//     const isRoyal = indices.join(',') === '8,9,10,11,12';
//     return {
//       hand: isRoyal ? 'Royal Flush' : 'Straight Flush',
//       rank: isRoyal ? HAND_RANKS.ROYAL_FLUSH : HAND_RANKS.STRAIGHT_FLUSH,
//       score,
//     };
//   }

//   if (counts[0] === 4) {
//     return { hand: 'Four of a Kind', rank: HAND_RANKS.FOUR_OF_A_KIND, score };
//   }
//   if (counts[0] === 3 && counts[1] === 2) {
//     return { hand: 'Full House', rank: HAND_RANKS.FULL_HOUSE, score };
//   }
//   if (flush) {
//     return { hand: 'Flush', rank: HAND_RANKS.FLUSH, score };
//   }
//   if (straight) {
//     return { hand: 'Straight', rank: HAND_RANKS.STRAIGHT, score };
//   }
//   if (counts[0] === 3) {
//     return { hand: 'Three of a Kind', rank: HAND_RANKS.THREE_OF_A_KIND, score };
//   }
//   if (counts[0] === 2 && counts[1] === 2) {
//     return { hand: 'Two Pair', rank: HAND_RANKS.TWO_PAIR, score };
//   }
//   if (counts[0] === 2) {
//     return { hand: 'One Pair', rank: HAND_RANKS.ONE_PAIR, score };
//   }
//   return { hand: 'High Card', rank: HAND_RANKS.HIGH_CARD, score };
// }

// /**
//  * Returns the best 5-card high hand from any set of cards.
//  * Used by Texas Hold'em and Seven-Card Stud.
//  */
// function getBestHighHand(cards: ICard[]): IHandResult {
//   return getCombinations(cards, 5).reduce(
//     (best, combo) => {
//       const result = evaluate5Cards(combo);
//       if (
//         result.rank > best.rank ||
//         (result.rank === best.rank && result.score > best.score)
//       ) {
//         return result;
//       }
//       return best;
//     },
//     { hand: 'High Card', rank: 0, score: 0 }
//   );
// }

// /**
//  * Texas Hold'em: best 5 from 2 hole cards + 5 community cards.
//  */
// function getTexasHoldemHand(
//   holeCards: ICard[],
//   communityCards: ICard[]
// ): IHandResult {
//   return getBestHighHand([...holeCards, ...communityCards]);
// }

// /**
//  * Omaha: must use exactly 2 hole cards and exactly 3 community cards.
//  */
// function getOmahaHand(
//   holeCards: ICard[],
//   communityCards: ICard[]
// ): IHandResult {
//   const holeCombos = getCombinations(holeCards, 2);
//   const communityCombos = getCombinations(communityCards, 3);

//   let best: IHandResult = { hand: 'High Card', rank: 0, score: 0 };

//   for (const hole of holeCombos) {
//     for (const community of communityCombos) {
//       const result = evaluate5Cards([...hole, ...community]);
//       if (
//         result.rank > best.rank ||
//         (result.rank === best.rank && result.score > best.score)
//       ) {
//         best = result;
//       }
//     }
//   }

//   return best;
// }

// /**
//  * Seven-Card Stud: best 5 of 7 hole cards. No community cards.
//  */
// function getSevenCardStudHand(holeCards: ICard[]): IHandResult {
//   return getBestHighHand(holeCards);
// }

// /**
//  * Five-Card Draw: evaluate exactly 5 hole cards directly.
//  */
// function getFiveCardDrawHand(holeCards: ICard[]): IHandResult {
//   return evaluate5Cards(holeCards);
// }

// /**
//  * Razz (A-5 lowball): ace is always low, lower hand wins.
//  * Straights and flushes do not count against the player.
//  * Best low 5-card hand from 7 hole cards.
//  * Returns a negated composite score so higher score = better low hand,
//  * keeping comparison consistent with high hand evaluation.
//  */
// function getRazzHand(holeCards: ICard[]): IHandResult {
//   let bestScore = -Infinity;
//   let bestTopCard = 13;

//   for (const combo of getCombinations(holeCards, 5)) {
//     const razzValues = combo
//       .map(c => RAZZ_RANK_VALUES[c.rank])
//       .sort((a, b) => b - a);

//     const razzScore = -(
//       razzValues[0] * 14 ** 4 +
//       razzValues[1] * 14 ** 3 +
//       razzValues[2] * 14 ** 2 +
//       razzValues[3] * 14 +
//       razzValues[4]
//     );

//     if (razzScore > bestScore) {
//       bestScore = razzScore;
//       bestTopCard = razzValues[0];
//     }
//   }

//   return {
//     hand: `${RAZZ_RANK_NAMES[bestTopCard]}-low`,
//     rank: 1,
//     score: bestScore,
//   };
// }

// /**
//  * Evaluates the best hand for a player based on the active game type.
//  */
// function evaluatePlayerHand(
//   player: IGamePlayer,
//   communityCards: ICard[],
//   gameType: PokerGameType
// ): IHandResult {
//   const { holeCards } = player;

//   switch (gameType) {
//     case "Texas Hold'em":
//       return getTexasHoldemHand(holeCards, communityCards);
//     case 'Omaha':
//       return getOmahaHand(holeCards, communityCards);
//     case 'Seven-Card Stud':
//       return getSevenCardStudHand(holeCards);
//     case 'Razz':
//       return getRazzHand(holeCards);
//     case 'Five-Card Draw':
//       return getFiveCardDrawHand(holeCards);
//     default:
//       console.warn(
//         `Unknown game type: ${gameType}. Defaulting to Texas Hold'em rules.`
//       );
//       return getTexasHoldemHand(holeCards, communityCards);
//   }
// }

// /**
//  * Evaluates all non-folded player hands for a given game type.
//  */
// export function evaluateHands(
//   players: IGamePlayer[],
//   communityCards: ICard[],
//   gameType: PokerGameType
// ): IPlayerHand[] {
//   return players
//     .filter(p => p.status !== 'folded')
//     .map(p => {
//       const result = evaluatePlayerHand(p, communityCards, gameType);
//       return {
//         playerId: p.userId,
//         hand: result.hand,
//         handRank: result.rank,
//         score: result.score,
//       };
//     });
// }

// /**
//  * Distributes each pot to its winner(s).
//  * Only players who contributed and have not folded are eligible.
//  * Split pots are divided equally — remainder (floating point) goes to first winner.
//  */
// export function evaluatePots(
//   players: IGamePlayer[],
//   communityCards: ICard[],
//   pots: WPot[],
//   gameType: PokerGameType
// ): IEvaluatedPot[] {
//   const handResults = evaluateHands(players, communityCards, gameType);

//   const handMap = new Map<string, IPlayerHand>(
//     handResults.map(h => [h.playerId.toString(), h])
//   );

//   const playerMap = new Map<string, IGamePlayer>(
//     players.map(p => [p.userId.toString(), p])
//   );

//   return pots.map(pot => {
//     const eligibleIds = pot.contributors
//       .map(c => c.playerId)
//       .filter(id => {
//         const player = playerMap.get(id);
//         return player && player.status !== 'folded';
//       });

//     if (eligibleIds.length === 0) {
//       return { ...pot, winners: [] };
//     }

//     if (eligibleIds.length === 1) {
//       const winner = playerMap.get(eligibleIds[0]);
//       if (!winner) return { ...pot, winners: [] };
//       return {
//         ...pot,
//         winners: [{ playerId: winner.userId, amount: pot.amount }],
//       };
//     }

//     const eligibleHands = eligibleIds
//       .map(id => handMap.get(id))
//       .filter((h): h is IPlayerHand => h !== undefined);

//     if (eligibleHands.length === 0) return { ...pot, winners: [] };

//     const bestRank = Math.max(...eligibleHands.map(h => h.handRank));
//     const bestScore = Math.max(
//       ...eligibleHands
//         .filter(h => h.handRank === bestRank)
//         .map(h => h.score)
//     );

//     const winnerHands = eligibleHands.filter(
//       h => h.handRank === bestRank && h.score === bestScore
//     );

//     const splitAmount =
//       Math.floor((pot.amount / winnerHands.length) * 100) / 100;
//     const remainder =
//       Math.round((pot.amount - splitAmount * winnerHands.length) * 100) / 100;

//     const winners = winnerHands.map((h, i) => ({
//       playerId: h.playerId,
//       amount: i === 0 ? splitAmount + remainder : splitAmount,
//     }));

//     return { ...pot, winners };
//   });
// }