/**
 * @fileoverview Hand Evaluator
 * Determines the winner(s) of each pot. Uses pokersolver for the heavy lifting
 * (5-card hand ranking) and adds game-specific card-selection rules on top
 * (Omaha's "exactly 2 hole + 3 community", Stud's "best 5 of 7", etc.).
 *
 * Card format conversion between our shape and pokersolver:
 *   { suit: 'hearts', rank: '10' }  ->  'Th'
 *
 * Supports: Texas Hold'em, Omaha, Seven-Card Stud, Razz, Five-Card Draw.
 * Pot amounts and winner amounts are INTEGER minor units; split-pot division
 * uses integer floor + remainder-to-first-winner, which is also the canonical
 * poker rule for indivisible chips.
 */

import { Hand } from 'pokersolver';
import { Types } from 'mongoose';
import { IGamePlayer, ICard } from '@/models/pokerDesk';
import { PokerGameType } from '@/models/poker';
import { WPot } from '@/engine/potCalculator';

export interface IEvaluatedPot {
  /** Pot size, minor units. */
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

/** Converts our ICard to a pokersolver card string (e.g. { rank: '10', suit: 'hearts' } -> 'Th'). */
function toPokerSolverCard(card: ICard): string {
  const rank = RANK_MAP[card.rank] ?? card.rank;
  const suit = SUIT_MAP[card.suit];
  return `${rank}${suit}`;
}

function toPokerSolverCards(cards: ICard[]): string[] {
  return cards.map(toPokerSolverCard);
}

/** All k-length combinations of an array (used for Omaha and Razz card selection). */
function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = getCombinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/** Texas Hold'em: pokersolver picks the best 5 from 2 hole + 5 community = 7. */
function solveTexasHoldem(
  holeCards: ICard[],
  communityCards: ICard[]
): ReturnType<typeof Hand.solve> {
  return Hand.solve(toPokerSolverCards([...holeCards, ...communityCards]));
}

/**
 * Omaha: MUST use exactly 2 hole cards and exactly 3 community cards.
 * Enumerate every valid combination, ask pokersolver to pick the best.
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

/** Seven-Card Stud: best 5 from 7 hole cards (pokersolver picks). */
function solveSevenCardStud(holeCards: ICard[]): ReturnType<typeof Hand.solve> {
  return Hand.solve(toPokerSolverCards(holeCards));
}

/** Five-Card Draw: evaluate the 5 hole cards directly. */
function solveFiveCardDraw(holeCards: ICard[]): ReturnType<typeof Hand.solve> {
  return Hand.solve(toPokerSolverCards(holeCards));
}

/**
 * Razz: A-5 lowball. Best LOW 5-card hand from 7 hole cards. Straights and
 * flushes don't count against the player; ace always plays low; lower wins.
 *
 * pokersolver doesn't support Razz in v2.1.4, so we evaluate all combinations
 * ourselves. To stay consistent with how high-hand winners are compared
 * (higher score wins), we NEGATE the lowball composite so a "better low" hand
 * has a numerically larger score.
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
      .map((c) => RAZZ_RANK_VALUES[RANK_MAP[c.rank] ?? c.rank])
      .sort((a, b) => b - a);

    const score = -(
      values[0] * 14 ** 4 +
      values[1] * 14 ** 3 +
      values[2] * 14 ** 2 +
      values[3] * 14 +
      values[4]
    );

    if (!best || score > best.score) {
      const topCardKey =
        Object.entries(RAZZ_RANK_VALUES).find(([, v]) => v === values[0])?.[0] ?? '?';
      best = {
        score,
        cards: combo,
        description: `${topCardKey === '1' ? 'A' : topCardKey}-low`,
      };
    }
  }

  return best!;
}

/** Dispatch a player's hand to the right solver for the active game type. */
function solvePlayerHand(
  player: IGamePlayer,
  communityCards: ICard[],
  gameType: PokerGameType
): ReturnType<typeof Hand.solve> | IRazzResult {
  // PokerGameType is narrowed to Hold'em + Omaha in this rebuild (LOGS.md
  // 2026-06-01). The Stud / Razz / 5-Draw branches below are preserved as
  // forward-compatible dead code for v2 restoration — `gameType as string`
  // lets the switch labels survive the type narrowing without TypeScript
  // errors. The default branch makes the dead-code branches unreachable today.
  switch (gameType as string) {
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
      console.warn(`Unknown game type: ${gameType}. Defaulting to Texas Hold'em.`);
      return solveTexasHoldem(player.holeCards, communityCards);
  }
}

/** Highest negated score wins in Razz (= best low hand). Returns tied winners. */
function getRazzWinners(
  hands: { playerId: Types.ObjectId; result: IRazzResult }[]
): Types.ObjectId[] {
  const bestScore = Math.max(...hands.map((h) => h.result.score));
  return hands.filter((h) => h.result.score === bestScore).map((h) => h.playerId);
}

/**
 * Awards each pot to its winner(s). For split pots, divides the integer pot
 * with integer floor division; the integer remainder (always < number of
 * winners, so a few minor units at most) goes to the first winner. This is
 * exact arithmetic and matches the standard poker convention for chips that
 * can't be split.
 */
export function evaluatePots(
  players: IGamePlayer[],
  communityCards: ICard[],
  pots: WPot[],
  gameType: PokerGameType
): IEvaluatedPot[] {
  const playerMap = new Map<string, IGamePlayer>(
    players.map((p) => [p.userId.toString(), p])
  );

  return pots.map((pot) => {
    // Folded players contributed money but can't win. Filter to eligible only.
    const eligiblePlayers = pot.contributors
      .map((c) => playerMap.get(c.playerId))
      .filter(
        (p): p is IGamePlayer => p !== undefined && p.status !== 'folded'
      );

    if (eligiblePlayers.length === 0) {
      return { ...pot, winners: [] };
    }

    // Single eligible player gets the whole pot — no comparison needed.
    if (eligiblePlayers.length === 1) {
      return {
        ...pot,
        winners: [{ playerId: eligiblePlayers[0].userId, amount: pot.amount }],
      };
    }

    let winnerIds: Types.ObjectId[];

    if ((gameType as string) === 'Razz') {
      const razzHands = eligiblePlayers.map((p) => ({
        playerId: p.userId,
        result: solveRazz(p.holeCards),
      }));
      winnerIds = getRazzWinners(razzHands);
    } else {
      const solvedHands = eligiblePlayers.map((p) => ({
        playerId: p.userId,
        hand: solvePlayerHand(p, communityCards, gameType) as Hand,
      }));
      const winnerHands = Hand.winners(solvedHands.map((h) => h.hand));
      winnerIds = solvedHands
        .filter((h) => winnerHands.includes(h.hand))
        .map((h) => h.playerId);
    }

    // Integer split: floor division, remainder to the first winner.
    // This is exact arithmetic and matches the standard poker chip-split rule.
    const splitAmount = Math.floor(pot.amount / winnerIds.length);
    const remainder = pot.amount - splitAmount * winnerIds.length;

    const winners = winnerIds.map((id, i) => ({
      playerId: id,
      amount: i === 0 ? splitAmount + remainder : splitAmount,
    }));

    return { ...pot, winners };
  });
}
// /**
//  * @fileoverview Hand Evaluator
//  * Determines the winner(s) of each pot. Uses pokersolver for the heavy lifting
//  * (5-card hand ranking) and adds game-specific card-selection rules on top
//  * (Omaha's "exactly 2 hole + 3 community", Stud's "best 5 of 7", etc.).
//  *
//  * Card format conversion between our shape and pokersolver:
//  *   { suit: 'hearts', rank: '10' }  ->  'Th'
//  *
//  * Supports: Texas Hold'em, Omaha, Seven-Card Stud, Razz, Five-Card Draw.
//  * Pot amounts and winner amounts are INTEGER minor units; split-pot division
//  * uses integer floor + remainder-to-first-winner, which is also the canonical
//  * poker rule for indivisible chips.
//  */

// import { Hand } from 'pokersolver';
// import { Types } from 'mongoose';
// import { IGamePlayer, ICard } from '@/models/pokerDesk';
// import { PokerGameType } from '@/models/poker';
// import { WPot } from '@/engine/potCalculator';

// export interface IEvaluatedPot {
//   /** Pot size, minor units. */
//   amount: number;
//   contributors: { playerId: string; contribution: number }[];
//   winners: { playerId: Types.ObjectId; amount: number }[];
// }

// const SUIT_MAP: Record<string, string> = {
//   hearts: 'h',
//   diamonds: 'd',
//   clubs: 'c',
//   spades: 's',
// };

// const RANK_MAP: Record<string, string> = {
//   '10': 'T',
// };

// /** Converts our ICard to a pokersolver card string (e.g. { rank: '10', suit: 'hearts' } -> 'Th'). */
// function toPokerSolverCard(card: ICard): string {
//   const rank = RANK_MAP[card.rank] ?? card.rank;
//   const suit = SUIT_MAP[card.suit];
//   return `${rank}${suit}`;
// }

// function toPokerSolverCards(cards: ICard[]): string[] {
//   return cards.map(toPokerSolverCard);
// }

// /** All k-length combinations of an array (used for Omaha and Razz card selection). */
// function getCombinations<T>(arr: T[], k: number): T[][] {
//   if (k === 0) return [[]];
//   if (arr.length === 0) return [];
//   const [first, ...rest] = arr;
//   const withFirst = getCombinations(rest, k - 1).map((c) => [first, ...c]);
//   const withoutFirst = getCombinations(rest, k);
//   return [...withFirst, ...withoutFirst];
// }

// /** Texas Hold'em: pokersolver picks the best 5 from 2 hole + 5 community = 7. */
// function solveTexasHoldem(
//   holeCards: ICard[],
//   communityCards: ICard[]
// ): ReturnType<typeof Hand.solve> {
//   return Hand.solve(toPokerSolverCards([...holeCards, ...communityCards]));
// }

// /**
//  * Omaha: MUST use exactly 2 hole cards and exactly 3 community cards.
//  * Enumerate every valid combination, ask pokersolver to pick the best.
//  */
// function solveOmaha(
//   holeCards: ICard[],
//   communityCards: ICard[]
// ): ReturnType<typeof Hand.solve> {
//   const holeCombos = getCombinations(holeCards, 2);
//   const communityCombos = getCombinations(communityCards, 3);

//   let bestHand: ReturnType<typeof Hand.solve> | null = null;

//   for (const hole of holeCombos) {
//     for (const community of communityCombos) {
//       const hand = Hand.solve(toPokerSolverCards([...hole, ...community]));
//       if (!bestHand) {
//         bestHand = hand;
//         continue;
//       }
//       const winners = Hand.winners([bestHand, hand]);
//       if (winners[0] === hand) bestHand = hand;
//     }
//   }

//   return bestHand!;
// }

// /** Seven-Card Stud: best 5 from 7 hole cards (pokersolver picks). */
// function solveSevenCardStud(holeCards: ICard[]): ReturnType<typeof Hand.solve> {
//   return Hand.solve(toPokerSolverCards(holeCards));
// }

// /** Five-Card Draw: evaluate the 5 hole cards directly. */
// function solveFiveCardDraw(holeCards: ICard[]): ReturnType<typeof Hand.solve> {
//   return Hand.solve(toPokerSolverCards(holeCards));
// }

// /**
//  * Razz: A-5 lowball. Best LOW 5-card hand from 7 hole cards. Straights and
//  * flushes don't count against the player; ace always plays low; lower wins.
//  *
//  * pokersolver doesn't support Razz in v2.1.4, so we evaluate all combinations
//  * ourselves. To stay consistent with how high-hand winners are compared
//  * (higher score wins), we NEGATE the lowball composite so a "better low" hand
//  * has a numerically larger score.
//  */
// interface IRazzResult {
//   score: number;
//   cards: ICard[];
//   description: string;
// }

// const RAZZ_RANK_VALUES: Record<string, number> = {
//   A: 1, '2': 2, '3': 3, '4': 4, '5': 5,
//   '6': 6, '7': 7, '8': 8, '9': 9, T: 10,
//   J: 11, Q: 12, K: 13,
// };

// function solveRazz(holeCards: ICard[]): IRazzResult {
//   const combos = getCombinations(holeCards, 5);
//   let best: IRazzResult | null = null;

//   for (const combo of combos) {
//     const values = combo
//       .map((c) => RAZZ_RANK_VALUES[RANK_MAP[c.rank] ?? c.rank])
//       .sort((a, b) => b - a);

//     const score = -(
//       values[0] * 14 ** 4 +
//       values[1] * 14 ** 3 +
//       values[2] * 14 ** 2 +
//       values[3] * 14 +
//       values[4]
//     );

//     if (!best || score > best.score) {
//       const topCardKey =
//         Object.entries(RAZZ_RANK_VALUES).find(([, v]) => v === values[0])?.[0] ?? '?';
//       best = {
//         score,
//         cards: combo,
//         description: `${topCardKey === '1' ? 'A' : topCardKey}-low`,
//       };
//     }
//   }

//   return best!;
// }

// /** Dispatch a player's hand to the right solver for the active game type. */
// function solvePlayerHand(
//   player: IGamePlayer,
//   communityCards: ICard[],
//   gameType: PokerGameType
// ): ReturnType<typeof Hand.solve> | IRazzResult {
//   switch (gameType) {
//     case "Texas Hold'em":
//       return solveTexasHoldem(player.holeCards, communityCards);
//     case 'Omaha':
//       return solveOmaha(player.holeCards, communityCards);
//     case 'Seven-Card Stud':
//       return solveSevenCardStud(player.holeCards);
//     case 'Five-Card Draw':
//       return solveFiveCardDraw(player.holeCards);
//     case 'Razz':
//       return solveRazz(player.holeCards);
//     default:
//       console.warn(`Unknown game type: ${gameType}. Defaulting to Texas Hold'em.`);
//       return solveTexasHoldem(player.holeCards, communityCards);
//   }
// }

// /** Highest negated score wins in Razz (= best low hand). Returns tied winners. */
// function getRazzWinners(
//   hands: { playerId: Types.ObjectId; result: IRazzResult }[]
// ): Types.ObjectId[] {
//   const bestScore = Math.max(...hands.map((h) => h.result.score));
//   return hands.filter((h) => h.result.score === bestScore).map((h) => h.playerId);
// }

// /**
//  * Awards each pot to its winner(s). For split pots, divides the integer pot
//  * with integer floor division; the integer remainder (always < number of
//  * winners, so a few minor units at most) goes to the first winner. This is
//  * exact arithmetic and matches the standard poker convention for chips that
//  * can't be split.
//  */
// export function evaluatePots(
//   players: IGamePlayer[],
//   communityCards: ICard[],
//   pots: WPot[],
//   gameType: PokerGameType
// ): IEvaluatedPot[] {
//   const playerMap = new Map<string, IGamePlayer>(
//     players.map((p) => [p.userId.toString(), p])
//   );

//   return pots.map((pot) => {
//     // Folded players contributed money but can't win. Filter to eligible only.
//     const eligiblePlayers = pot.contributors
//       .map((c) => playerMap.get(c.playerId))
//       .filter(
//         (p): p is IGamePlayer => p !== undefined && p.status !== 'folded'
//       );

//     if (eligiblePlayers.length === 0) {
//       return { ...pot, winners: [] };
//     }

//     // Single eligible player gets the whole pot — no comparison needed.
//     if (eligiblePlayers.length === 1) {
//       return {
//         ...pot,
//         winners: [{ playerId: eligiblePlayers[0].userId, amount: pot.amount }],
//       };
//     }

//     let winnerIds: Types.ObjectId[];

//     if (gameType === 'Razz') {
//       const razzHands = eligiblePlayers.map((p) => ({
//         playerId: p.userId,
//         result: solveRazz(p.holeCards),
//       }));
//       winnerIds = getRazzWinners(razzHands);
//     } else {
//       const solvedHands = eligiblePlayers.map((p) => ({
//         playerId: p.userId,
//         hand: solvePlayerHand(p, communityCards, gameType) as Hand,
//       }));
//       const winnerHands = Hand.winners(solvedHands.map((h) => h.hand));
//       winnerIds = solvedHands
//         .filter((h) => winnerHands.includes(h.hand))
//         .map((h) => h.playerId);
//     }

//     // Integer split: floor division, remainder to the first winner.
//     // This is exact arithmetic and matches the standard poker chip-split rule.
//     const splitAmount = Math.floor(pot.amount / winnerIds.length);
//     const remainder = pot.amount - splitAmount * winnerIds.length;

//     const winners = winnerIds.map((id, i) => ({
//       playerId: id,
//       amount: i === 0 ? splitAmount + remainder : splitAmount,
//     }));

//     return { ...pot, winners };
//   });
// }