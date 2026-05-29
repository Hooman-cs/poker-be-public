/**
 * @fileoverview Poker Game Engine — pure functions for game logic.
 * No mongoose, no DB, no side effects. Every function takes plain data and
 * returns plain data. The service layer (src/services/gameService.ts) calls
 * these and applies the results to documents, owning all persistence.
 *
 * All money values are INTEGER minor units (paise/cents).
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
  /** Player's seat balance after the action, minor units. */
  updatedSeatBalance: number;
  /** Game's running total bet after the action, minor units. */
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

/** A player record as it will be persisted in PokerGameArchive. */
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

/**
 * What `advanceRound` produces. The service applies these to the document and
 * saves; it never inspects the engine's reasoning, only the result.
 */
export interface IAdvanceRoundResult {
  /** The new round to push onto game.rounds. */
  newRound: IRound;
  /** Community cards to APPEND to game.communityCards (may be empty for showdown). */
  newCommunityCards: ICard[];
  /** Who acts first in the new round (null on showdown). */
  nextTurnPlayer: Types.ObjectId | null;
}

const SUITS: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: CardRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const ROUND_ORDER: RoundName[] = ['pre-flop', 'flop', 'turn', 'river', 'showdown'];

const HOLE_CARDS_BY_GAME: Partial<Record<PokerGameType, number>> = {
  Omaha: 4,
  'Seven-Card Stud': 7,
};

/** Returns a freshly shuffled 52-card deck. */
export function generateDeck(): ICard[] {
  const deck: ICard[] = SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({ suit, rank }))
  );
  return shuffleDeck(deck);
}

/** Fisher-Yates shuffle, returns a new array (does not mutate input). */
export function shuffleDeck(deck: ICard[]): ICard[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deals `count` cards from `deck`, avoiding any cards already in `usedCards`.
 * Returns the dealt cards and the remaining deck.
 */
export function dealCards(
  deck: ICard[],
  count: number,
  usedCards: ICard[] = []
): { dealt: ICard[]; remaining: ICard[] } {
  const usedSet = new Set<string>(usedCards.map((c) => `${c.rank}${c.suit}`));
  const available = deck.filter((c) => !usedSet.has(`${c.rank}${c.suit}`));
  const dealt: ICard[] = [];
  const remaining = [...available];

  while (dealt.length < count && remaining.length > 0) {
    dealt.push(remaining.pop()!);
  }

  return { dealt, remaining };
}

/** Hole-card count for the active game type (defaults to 2 for Hold'em / Razz / 5CD). */
export function getHoleCardCount(gameType: PokerGameType): number {
  return HOLE_CARDS_BY_GAME[gameType] ?? 2;
}

/** Walks player order from `currentUserId` and returns the next active player. */
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

/** First active player from index 0 — used to set first-to-act on a new round. */
export function getFirstActivePlayer(
  players: IGamePlayer[]
): Types.ObjectId | null {
  return players.find((p) => p.status === 'active')?.userId ?? null;
}

/**
 * Amount this player still owes to match the highest bet of the round.
 * Negative bets are impossible (model guards reject them) so the result is >= 0.
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
    if (playerBets[key] > maxBet) maxBet = playerBets[key];
  }

  const playerTotalBet = playerBets[userId.toString()] || 0;
  return Math.max(0, maxBet - playerTotalBet);
}

/**
 * Computes the result of a single player action without mutating inputs.
 * The caller (service) applies updatedPlayer / updatedSeatBalance /
 * updatedTotalBet to the document and persists.
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

    // Going all-in (either explicitly, or by trying to bet >= remaining stack).
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
 * Decides whether the hand continues, advances to the next round, or goes to
 * showdown. The service inspects `type` and calls `advanceRound` or proceeds
 * to showdown accordingly.
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

  const actionPlayerIds = new Set(round.actions.map((a) => a.userId.toString()));

  // If the next player hasn't acted yet this round, the round continues.
  if (!actionPlayerIds.has(nextPlayerId.toString())) {
    return { type: 'continue', nextPlayerId };
  }

  // Everyone has acted: check if bets are equal (round closed).
  const totalBets = round.actions.reduce(
    (acc: Record<string, number>, act) => {
      const key = act.userId.toString();
      acc[key] = (acc[key] || 0) + act.amount;
      return acc;
    },
    {}
  );

  const uniqueBets = new Set(Object.values(totalBets));
  const activeOnlyCount = activePlayers.filter((p) => p.status === 'active').length;

  if (uniqueBets.size === 1 && (round.name === 'river' || activeOnlyCount === 1)) {
    return { type: 'showdown', nextPlayerId: null };
  }

  if (uniqueBets.size === 1) {
    const currentRoundIndex = ROUND_ORDER.indexOf(round.name);
    const nextRoundName = ROUND_ORDER[currentRoundIndex + 1];
    return { type: 'nextRound', nextPlayerId: null, nextRoundName };
  }

  return { type: 'continue', nextPlayerId };
}

/**
 * Builds the initial game state from active seats. Seats with insufficient
 * balance to meet minBuyIn are excluded — the service is responsible for
 * cleaning those seats up after this returns.
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

  // Blind/ante semantics (settled): SB = stake, BB = 2*stake, ante = stake.
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
  // First to act pre-flop: UTG (player after BB) in blinds; player[0] in antes / heads-up.
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

/** Number of community cards to deal at the start of a given round. */
export function getRoundCardCount(roundName: RoundName): number {
  switch (roundName) {
    case 'flop': return 3;
    case 'turn': return 1;
    case 'river': return 1;
    default: return 0;
  }
}

/** Next round after `currentRound`, or null if past river. */
export function getNextRoundName(currentRound: RoundName): RoundName | null {
  const index = ROUND_ORDER.indexOf(currentRound);
  if (index === -1 || index >= ROUND_ORDER.length - 1) return null;
  return ROUND_ORDER[index + 1];
}

/**
 * Composes the pieces above into a single "what happens when we advance the
 * round" answer. The service uses the result to push the new round, append
 * any community cards, and update currentTurnPlayer in one persist step.
 *
 * Throws if there is no next round (the service should have routed to
 * showdown via determineRoundProgression in that case).
 */
export function advanceRound(
  currentRoundName: RoundName,
  players: IGamePlayer[],
  existingCommunityCards: ICard[]
): IAdvanceRoundResult {
  const nextRoundName = getNextRoundName(currentRoundName);
  if (!nextRoundName) {
    throw new Error(`No round after ${currentRoundName}`);
  }

  // Showdown is a logical "round" with no betting and no community cards dealt here.
  if (nextRoundName === 'showdown') {
    return {
      newRound: {
        name: 'showdown',
        bettingRoundStartedAt: new Date(),
        actions: [],
      },
      newCommunityCards: [],
      nextTurnPlayer: null,
    };
  }

  const cardCount = getRoundCardCount(nextRoundName);
  const usedCards: ICard[] = [
    ...players.flatMap((p) => p.holeCards),
    ...existingCommunityCards,
  ];
  const { dealt } = dealCards(generateDeck(), cardCount, usedCards);

  return {
    newRound: {
      name: nextRoundName,
      bettingRoundStartedAt: new Date(),
      actions: [],
    },
    newCommunityCards: dealt,
    nextTurnPlayer: getFirstActivePlayer(players),
  };
}

/**
 * Builds the archive payload for PokerGameArchive.create(). Takes a
 * `userId -> username` map (built by the service via one User.find) so the
 * archive's required username fields are populated — preventing the empty-
 * string crash where the archive's `required: true` validator rejected blank
 * usernames at showdown.
 *
 * If a userId is unexpectedly missing from the map, falls back to the literal
 * string 'unknown' so an archive write never crashes a hand mid-finalization;
 * the service should log this as a data anomaly.
 */
export function buildArchiveData(
  seats: ISeat[],
  players: IGamePlayer[],
  potResults: { amount: number; winners: { playerId: Types.ObjectId; amount: number }[] }[],
  totalPot: number,
  startedAt: Date,
  usernameByUserId: Map<string, string>
): IArchiveData {
  const nameFor = (id: Types.ObjectId): string =>
    usernameByUserId.get(id.toString()) ?? 'unknown';

  const archivePlayers: IArchivePlayer[] = players.map((p) => {
    const seat = seats.find((s) => s.userId.equals(p.userId));
    const isWinner = potResults.some((pot) =>
      pot.winners.some((w) => w.playerId.equals(p.userId))
    );
    return {
      userId: p.userId,
      username: nameFor(p.userId),
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
    winners: pot.winners.map((w) => ({
      playerId: w.playerId,
      username: nameFor(w.playerId),
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