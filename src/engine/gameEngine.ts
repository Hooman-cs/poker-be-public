/**
 * @fileoverview Poker Game Engine
 * Pure functions for poker game logic.
 * No mongoose dependencies — all functions take plain data and return plain data.
 * Schema methods in pokerDesk.ts call these functions and apply results to the document.
 */

import {
  ICard,
  IGamePlayer,
  IRound,
  IPlayerActionRecord,
  IGamePot,
  ISeat,
  PlayerAction,
  PlayerRole,
  PlayerStatus,
  RoundName,
  CardSuit,
  CardRank,
} from '@/models/pokerDesk';
import { PokerGameType } from '@/models/poker';
import { Types } from 'mongoose';

export interface IGameState {
  players: IGamePlayer[];
  currentTurnPlayer: Types.ObjectId | null;
  totalBet: number;
  pots: IGamePot[];
  rounds: IRound[];
  communityCards: ICard[];
}

export interface IActionResult {
  actionRecord: IPlayerActionRecord;
  updatedPlayer: IGamePlayer;
  updatedSeatBalance: number;
  updatedTotalBet: number;
}

export interface IRoundProgression {
  type: 'continue' | 'nextRound' | 'showdown';
  nextPlayerId: Types.ObjectId | null;
  nextRoundName?: RoundName;
}

export interface IInitialGameState {
  players: IGamePlayer[];
  currentTurnPlayer: Types.ObjectId;
  totalBet: number;
  pots: IGamePot[];
  rounds: IRound[];
  communityCards: ICard[];
  deck: ICard[];
}

export interface IArchivePlayer {
  userId: Types.ObjectId;
  username: string;
  seatNumber: number;
  startingStack: number;
  endingStack: number;
  totalBet: number;
  isWinner: boolean;
}

export interface IArchivePot {
  potNumber: number;
  totalAmount: number;
  winners: {
    playerId: Types.ObjectId;
    username: string;
    amount: number;
    handDescription: string;
  }[];
}

export interface IArchiveData {
  players: IArchivePlayer[];
  pots: IArchivePot[];
  totalPot: number;
  startedAt: Date;
  completedAt: Date;
}

const SUITS: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: CardRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const ROUND_ORDER: RoundName[] = ['pre-flop', 'flop', 'turn', 'river', 'showdown'];

const HOLE_CARDS_BY_GAME: Partial<Record<PokerGameType, number>> = {
  'Omaha': 4,
  'Seven-Card Stud': 7,
};

/**
 * Generates a freshly shuffled 52-card deck.
 */
export function generateDeck(): ICard[] {
  const deck: ICard[] = SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({ suit, rank }))
  );
  return shuffleDeck(deck);
}

/**
 * Shuffles an array of cards in place using Fisher-Yates algorithm.
 */
export function shuffleDeck(deck: ICard[]): ICard[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deals N cards from a deck, avoiding cards already in use.
 */
export function dealCards(
  deck: ICard[],
  count: number,
  usedCards: ICard[] = []
): { dealt: ICard[]; remaining: ICard[] } {
  const usedSet = new Set<string>(
    usedCards.map((c) => `${c.rank}${c.suit}`)
  );

  const available = deck.filter((c) => !usedSet.has(`${c.rank}${c.suit}`));
  const dealt: ICard[] = [];
  const remaining = [...available];

  while (dealt.length < count && remaining.length > 0) {
    dealt.push(remaining.pop()!);
  }

  return { dealt, remaining };
}

/**
 * Returns the number of hole cards for a given game type.
 */
export function getHoleCardCount(gameType: PokerGameType): number {
  return HOLE_CARDS_BY_GAME[gameType] ?? 2;
}

/**
 * Finds the next active player after the current player in turn order.
 * Returns null if no active player is found.
 */
export function getNextActivePlayer(
  players: IGamePlayer[],
  currentUserId: Types.ObjectId
): Types.ObjectId | null {
  const currentIndex = players.findIndex((p) => p.userId.equals(currentUserId));
  if (currentIndex === -1) return null;

  let nextIndex = (currentIndex + 1) % players.length;
  for (let i = 0; i < players.length; i++) {
    if (players[nextIndex].status === 'active') {
      return players[nextIndex].userId;
    }
    nextIndex = (nextIndex + 1) % players.length;
  }
  return null;
}

/**
 * Finds the first active player in the players array.
 * Returns null if no active player is found.
 */
export function getFirstActivePlayer(
  players: IGamePlayer[]
): Types.ObjectId | null {
  const activePlayer = players.find((p) => p.status === 'active');
  return activePlayer?.userId ?? null;
}

/**
 * Calculates how much a player needs to call in the current round.
 */
export function calculateCallAmount(
  round: IRound,
  userId: Types.ObjectId
): number {
  let maxBet = 0;
  const playerBets: Record<string, number> = {};

  for (const act of round.actions) {
    const key = act.userId.toString();
    playerBets[key] = (playerBets[key] || 0) + act.amount;
    maxBet = Math.max(maxBet, playerBets[key]);
  }

  const playerTotalBet = playerBets[userId.toString()] || 0;
  return Math.max(0, maxBet - playerTotalBet);
}

/**
 * Processes a player action and returns the updated state.
 * Does not mutate inputs — returns new values for caller to apply.
 */
export function processPlayerAction(
  player: IGamePlayer,
  seatBalance: number,
  totalBet: number,
  round: IRound,
  action: PlayerAction,
  amount: number = 0
): IActionResult {
  const callAmount = calculateCallAmount(round, player.userId);

  const actionRecord: IPlayerActionRecord = {
    userId: player.userId,
    action: 'fold',
    amount: 0,
    timestamp: new Date(),
  };

  let updatedPlayer: IGamePlayer = { ...player };
  let updatedSeatBalance = seatBalance;
  let updatedTotalBet = totalBet;

  if (action === 'fold') {
    updatedPlayer.status = 'folded';
    actionRecord.action = 'fold';

  } else if (action === 'check') {
    if (callAmount !== 0) throw new Error('Cannot check — there is an active bet to call.');
    actionRecord.action = 'check';

  } else if (['call', 'raise', 'all-in'].includes(action)) {
    let finalAmount = action === 'raise' ? amount : callAmount;

    if (action === 'all-in' || finalAmount >= updatedPlayer.balanceAtTable) {
      finalAmount = updatedPlayer.balanceAtTable;
      actionRecord.action =
        callAmount === 0 && finalAmount === 0 ? 'check' : 'all-in';
      if (actionRecord.action === 'all-in') {
        updatedPlayer = { ...updatedPlayer, status: 'all-in' };
      }
    } else {
      actionRecord.action = finalAmount === callAmount ? 'call' : 'raise';
    }

    updatedPlayer = {
      ...updatedPlayer,
      balanceAtTable: updatedPlayer.balanceAtTable - finalAmount,
      totalBet: updatedPlayer.totalBet + finalAmount,
    };
    updatedSeatBalance -= finalAmount;
    updatedTotalBet += finalAmount;
    actionRecord.amount = finalAmount;

  } else {
    throw new Error(`Invalid action: ${action}`);
  }

  return { actionRecord, updatedPlayer, updatedSeatBalance, updatedTotalBet };
}

/**
 * Determines what should happen after a player action.
 * Returns whether to continue, advance to next round, or go to showdown.
 */
export function determineRoundProgression(
  players: IGamePlayer[],
  round: IRound,
  currentUserId: Types.ObjectId
): IRoundProgression {
  const activePlayers = players.filter(
    (p) => p.status === 'active' || p.status === 'all-in'
  );

  if (activePlayers.length <= 1) {
    return { type: 'showdown', nextPlayerId: null };
  }

  const nextPlayerId = getNextActivePlayer(players, currentUserId);

  if (!nextPlayerId) {
    return { type: 'showdown', nextPlayerId: null };
  }

  const actionPlayerIds = new Set(
    round.actions.map((a) => a.userId.toString())
  );

  if (!actionPlayerIds.has(nextPlayerId.toString())) {
    return { type: 'continue', nextPlayerId };
  }

  const totalBets = round.actions.reduce(
    (acc: Record<string, number>, act) => {
      const key = act.userId.toString();
      acc[key] = (acc[key] || 0) + act.amount;
      return acc;
    },
    {}
  );

  const uniqueBets = new Set(Object.values(totalBets));
  const activeOnlyCount = activePlayers.filter(
    (p) => p.status === 'active'
  ).length;

  if (uniqueBets.size === 1 && (round.name === 'river' || activeOnlyCount === 1)) {
    return { type: 'showdown', nextPlayerId: null };
  }

  if (uniqueBets.size === 1) {
    const currentRoundIndex = ROUND_ORDER.indexOf(round.name);
    const nextRoundName = ROUND_ORDER[currentRoundIndex + 1];
    return {
      type: 'nextRound',
      nextPlayerId: null,
      nextRoundName,
    };
  }

  return { type: 'continue', nextPlayerId };
}

/**
 * Builds the initial game state from active seats.
 * Returns the full initial game state and the deck used.
 */
export function initializeGameState(
  seats: ISeat[],
  bType: 'blinds' | 'antes',
  stake: number,
  gameType: PokerGameType,
  minBuyIn: number
): IInitialGameState {
  const eligibleSeats = seats.filter(
    (s) => s.status === 'active' && s.balanceAtTable >= minBuyIn
  );

  const players: IGamePlayer[] = eligibleSeats.map((s) => ({
    userId: s.userId,
    balanceAtTable: s.balanceAtTable,
    status: 'active' as PlayerStatus,
    totalBet: 0,
    holeCards: [],
    role: 'player' as PlayerRole,
  }));

  const isBlinds = bType === 'blinds';
  const smallBlindAmount = isBlinds ? stake : 0;
  const bigBlindAmount = isBlinds ? stake * 2 : 0;
  const anteAmount = isBlinds ? 0 : stake;
  const holeCardsCount = getHoleCardCount(gameType);

  const initialActions: IPlayerActionRecord[] = [];

  if (isBlinds) {
    players[0].role = 'sb';
    players[1].role = 'bb';
    players[0].totalBet = smallBlindAmount;
    players[1].totalBet = bigBlindAmount;
    players[0].balanceAtTable -= smallBlindAmount;
    players[1].balanceAtTable -= bigBlindAmount;

    initialActions.push(
      { userId: players[0].userId, action: 'small-blind', amount: smallBlindAmount, timestamp: new Date() },
      { userId: players[1].userId, action: 'big-blind', amount: bigBlindAmount, timestamp: new Date() }
    );
  } else {
    players.forEach((p) => {
      p.balanceAtTable -= anteAmount;
      p.totalBet += anteAmount;
      initialActions.push({
        userId: p.userId,
        action: 'ante',
        amount: anteAmount,
        timestamp: new Date(),
      });
    });
  }

  const deck = generateDeck();
  players.forEach((p) => {
    p.holeCards = Array.from({ length: holeCardsCount }, () => deck.pop()!);
  });

  const initialPot = players.reduce((sum, p) => sum + p.totalBet, 0);
  const firstToAct = isBlinds
    ? players[2]?.userId ?? players[0].userId
    : players[0].userId;

  return {
    players,
    currentTurnPlayer: firstToAct,
    totalBet: initialPot,
    pots: [],
    rounds: [
      {
        name: 'pre-flop',
        bettingRoundStartedAt: new Date(),
        actions: initialActions,
      },
    ],
    communityCards: [],
    deck,
  };
}

/**
 * Deals community cards for a given round.
 * Returns the cards to add to communityCards.
 */
export function getCommunityCardsForRound(
  roundName: RoundName,
  existingPlayers: IGamePlayer[],
  existingCommunityCards: ICard[]
): ICard[] {
  const usedCards: ICard[] = [
    ...existingPlayers.flatMap((p) => p.holeCards),
    ...existingCommunityCards,
  ];

  const deck = generateDeck();
  const { dealt } = dealCards(deck, getRoundCardCount(roundName), usedCards);
  return dealt;
}

/**
 * Returns the number of community cards to deal for a given round.
 */
export function getRoundCardCount(roundName: RoundName): number {
  switch (roundName) {
    case 'flop': return 3;
    case 'turn': return 1;
    case 'river': return 1;
    default: return 0;
  }
}

/**
 * Returns the next round name after the given round.
 * Returns null if there is no next round.
 */
export function getNextRoundName(currentRound: RoundName): RoundName | null {
  const index = ROUND_ORDER.indexOf(currentRound);
  if (index === -1 || index >= ROUND_ORDER.length - 1) return null;
  return ROUND_ORDER[index + 1];
}

/**
 * Builds the data needed to create a PokerGameArchive document.
 */
export function buildArchiveData(
  seats: ISeat[],
  players: IGamePlayer[],
  potResults: any[],
  totalPot: number,
  startedAt: Date
): IArchiveData {
  const archivePlayers: IArchivePlayer[] = players.map((p) => {
    const seat = seats.find((s) => s.userId.equals(p.userId));
    const isWinner = potResults.some((pot) =>
      pot.winners.some((w: any) => w.playerId.equals(p.userId))
    );
    return {
      userId: p.userId,
      username: '',
      seatNumber: seat?.seatNumber ?? 0,
      startingStack: seat?.buyInAmount ?? 0,
      endingStack: seat?.balanceAtTable ?? 0,
      totalBet: p.totalBet,
      isWinner,
    };
  });

  const archivePots: IArchivePot[] = potResults.map((pot, index) => ({
    potNumber: index + 1,
    totalAmount: pot.amount,
    winners: pot.winners.map((w: any) => ({
      playerId: w.playerId,
      username: '',
      amount: w.amount,
      handDescription: '',
    })),
  }));

  return {
    players: archivePlayers,
    pots: archivePots,
    totalPot,
    startedAt,
    completedAt: new Date(),
  };
}