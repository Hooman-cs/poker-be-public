/**
 * @fileoverview Poker Desk Model
 * Manages active poker table state including seats, observers and live game data.
 * Pure game logic lives in src/engine/gameEngine.ts
 * Wallet operations use the separated Wallet and WalletTransaction models.
 */

import mongoose, { Schema, Document, Types, Model } from 'mongoose';
import Wallet from '@/models/wallet';
import WalletTransaction from '@/models/walletTransaction';
import PokerGameArchive from '@/models/pokerGameArchive';
import { PokerGameType } from '@/models/poker';
import { evaluatePots } from '@/engine/evaluate';
import { createPots } from '@/engine/createPots';
import {
  initializeGameState,
  processPlayerAction,
  determineRoundProgression,
  buildArchiveData,
} from '@/engine/gameEngine';
import { generateDeck, dealCards as dealCardsFromDeck } from '@/engine/gameEngine';

export type SeatStatus = 'active' | 'disconnected' | 'sittingOut';
export type PlayerStatus = 'active' | 'all-in' | 'folded' | 'sitting-out';
export type PlayerRole = 'sb' | 'bb' | 'player';
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';
export type RoundName = 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';
export type GameStatus = 'waiting' | 'in-progress' | 'finished';
export type DeskStatus = 'active' | 'disabled';
export type BettingType = 'blinds' | 'antes';
export type ModeType = 'cash' | 'practice';

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type CardRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface ICard {
  suit: CardSuit;
  rank: CardRank;
}

export interface ISeat {
  seatNumber: number;
  userId: Types.ObjectId;
  buyInAmount: number;
  balanceAtTable: number;
  status: SeatStatus;
}

export interface IGamePlayer {
  userId: Types.ObjectId;
  balanceAtTable: number;
  status: PlayerStatus;
  totalBet: number;
  holeCards: ICard[];
  role: PlayerRole;
}

export interface IPlayerActionRecord {
  userId: Types.ObjectId;
  action: PlayerAction | 'small-blind' | 'big-blind' | 'ante';
  amount: number;
  timestamp: Date;
}

export interface IRound {
  name: RoundName;
  bettingRoundStartedAt: Date;
  actions: IPlayerActionRecord[];
}

export interface IPotContributor {
  playerId: Types.ObjectId;
  contribution: number;
}

export interface IPotWinner {
  playerId: Types.ObjectId;
  amount: number;
}

export interface IGamePot {
  amount: number;
  contributors: IPotContributor[];
  winners: IPotWinner[];
}

export interface IPokerGame {
  players: IGamePlayer[];
  currentTurnPlayer: Types.ObjectId | null;
  totalBet: number;
  status: GameStatus;
  rounds: IRound[];
  communityCards: ICard[];
  pots: IGamePot[];
}

export interface IPokerDesk {
  pokerModeId: Types.ObjectId;
  tableName: string;
  gameType: PokerGameType;
  bType: BettingType;
  mode: ModeType;
  status: DeskStatus;
  stake: number;
  minBuyIn: number;
  maxBuyIn: number;
  minPlayerCount: number;
  maxPlayerCount: number;
  maxSeats: number;
  seats: ISeat[];
  observers: Types.ObjectId[];
  currentGame: IPokerGame | null;
  currentGameStatus: GameStatus;
  totalBuyIns: number;
}

export interface IPokerGameSubdocument extends IPokerGame, Types.Subdocument {
  dealCardsFromDeck(count: number, cardType?: 'hole' | 'community'): ICard[];
  getNextActivePlayer(currentUserId: Types.ObjectId): Types.ObjectId | null;
  getFirstActivePlayer(): Types.ObjectId | null;
  startNextRound(prevRoundName?: RoundName): Promise<void>;
}

export interface IPokerDeskDocument extends Omit<IPokerDesk, 'seats' | 'observers' | 'currentGame'>, Document {
  seats: Types.DocumentArray<ISeat & Types.Subdocument>;
  observers: Types.Array<Types.ObjectId>;
  currentGame: IPokerGameSubdocument | null;
  addUserToSeat(userId: Types.ObjectId, buyInAmount: number): Promise<ISeat>;
  addWalletBalance(userId: Types.ObjectId, amount: number): Promise<void>;
  userLeavesSeat(userId: Types.ObjectId): Promise<number>;
  updateSeatStatus(userId: Types.ObjectId, status: SeatStatus): Promise<void>;
  addObserver(userId: Types.ObjectId): Promise<void>;
  removeObserver(userId: Types.ObjectId): Promise<void>;
  isUserSeated(userId: Types.ObjectId): boolean;
  createGameFromTable(): Promise<IPokerGame>;
  handlePlayerAction(userId: Types.ObjectId, action: PlayerAction, amount?: number): Promise<IPlayerActionRecord>;
  showdown(): Promise<void>;
}

const SeatSchema = new Schema<ISeat & Types.Subdocument>(
  {
    seatNumber: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    buyInAmount: { type: Number, default: 0 },
    balanceAtTable: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'disconnected', 'sittingOut'],
      default: 'active',
    },
  },
  { _id: false }
);

const PlayerSchema = new Schema<IGamePlayer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    balanceAtTable: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'all-in', 'folded', 'sitting-out'],
      default: 'active',
    },
    totalBet: { type: Number, default: 0 },
    holeCards: [
      {
        suit: { type: String, enum: ['hearts', 'diamonds', 'clubs', 'spades'] },
        rank: { type: String, enum: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] },
      },
    ],
    role: {
      type: String,
      enum: ['sb', 'bb', 'player'],
      default: 'player',
    },
  },
  { _id: false }
);

const ActionSchema = new Schema<IPlayerActionRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: ['fold', 'check', 'call', 'raise', 'all-in', 'small-blind', 'big-blind', 'ante'],
      required: true,
    },
    amount: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RoundSchema = new Schema<IRound>(
  {
    name: {
      type: String,
      enum: ['pre-flop', 'flop', 'turn', 'river', 'showdown'],
      required: true,
    },
    bettingRoundStartedAt: { type: Date, default: Date.now },
    actions: { type: [ActionSchema], default: [] },
  },
  { _id: false }
);

const PotContributorSchema = new Schema<IPotContributor>(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contribution: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const PotWinnerSchema = new Schema<IPotWinner>(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const PotSchema = new Schema<IGamePot>(
  {
    amount: { type: Number, required: true, default: 0 },
    contributors: { type: [PotContributorSchema], default: [] },
    winners: { type: [PotWinnerSchema], default: [] },
  },
  { _id: false }
);

const CardSchema = new Schema<ICard>(
  {
    suit: {
      type: String,
      enum: ['hearts', 'diamonds', 'clubs', 'spades'],
      required: true,
    },
    rank: {
      type: String,
      enum: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'],
      required: true,
    },
  },
  { _id: false }
);

// const generateDeck = (): ICard[] => {
//   const suits: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
//   const ranks: CardRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
//   const deck: ICard[] = suits.flatMap((suit) => ranks.map((rank) => ({ suit, rank })));
//   for (let i = deck.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [deck[i], deck[j]] = [deck[j], deck[i]];
//   }
//   return deck;
// };

const PokerGameSchema = new Schema<IPokerGameSubdocument>(
  {
    players: { type: [PlayerSchema], default: [] },
    currentTurnPlayer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    totalBet: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['waiting', 'in-progress', 'finished'],
      default: 'waiting',
    },
    rounds: { type: [RoundSchema], default: [] },
    communityCards: { type: [CardSchema], default: [] },
    pots: { type: [PotSchema], default: [] },
  },
  { _id: false, timestamps: true }
);

PokerGameSchema.methods.dealCards = function (
  count: number,
  cardType: 'hole' | 'community' = 'community'
): ICard[] {
  const usedCards = new Set<string>(
    this.players
      .flatMap((p: IGamePlayer) => p.holeCards)
      .concat(this.communityCards)
      .map((c: ICard) => `${c.rank}${c.suit}`)
  );

  const deck = generateDeck().filter(
    (c) => !usedCards.has(`${c.rank}${c.suit}`)
  );

  const dealtCards: ICard[] = [];
  while (dealtCards.length < count && deck.length > 0) {
    dealtCards.push(deck.pop()!);
  }
  return dealtCards;
};

PokerGameSchema.methods.getNextActivePlayer = function (
  currentUserId: Types.ObjectId
): Types.ObjectId | null {
  const currentIndex = this.players.findIndex((p: IGamePlayer) =>
    p.userId.equals(currentUserId)
  );
  if (currentIndex === -1) return null;

  let nextIndex = (currentIndex + 1) % this.players.length;
  for (let i = 0; i < this.players.length; i++) {
    const nextPlayer = this.players[nextIndex];
    if (nextPlayer.status === 'active') return nextPlayer.userId;
    nextIndex = (nextIndex + 1) % this.players.length;
  }
  return null;
};

PokerGameSchema.methods.getFirstActivePlayer = function (): Types.ObjectId | null {
  for (const player of this.players) {
    if (player.status === 'active') return player.userId;
  }
  return null;
};

PokerGameSchema.methods.startNextRound = async function (
  prevRoundName?: RoundName
): Promise<void> {
  const roundOrder: RoundName[] = ['pre-flop', 'flop', 'turn', 'river', 'showdown'];

  const lastRound = prevRoundName || (this.rounds.length ? this.rounds[this.rounds.length - 1].name : null);
  const nextRoundIndex = lastRound ? roundOrder.indexOf(lastRound) + 1 : 0;

  if (nextRoundIndex >= roundOrder.length) throw new Error('All rounds completed.');

  const roundName = roundOrder[nextRoundIndex];

  if (this.rounds.some((r: IRound) => r.name === roundName)) {
    throw new Error(`Round ${roundName} already started.`);
  }

  this.rounds.push({ name: roundName, bettingRoundStartedAt: new Date(), actions: [] });

  switch (roundName) {
    case 'flop':
      this.communityCards.push(...this.dealCards(3, 'community'));
      break;
    case 'turn':
    case 'river':
      this.communityCards.push(...this.dealCards(1, 'community'));
      break;
    case 'showdown':
      return;
    default:
      break;
  }

  this.currentTurnPlayer = this.getFirstActivePlayer();
  const parent = this.parent() as IPokerDeskDocument | null;
  if (parent) await parent.save();
};

const PokerDeskSchema = new Schema<IPokerDeskDocument>(
  {
    pokerModeId: {
      type: Schema.Types.ObjectId,
      ref: 'PokerMode',
      required: [true, 'Poker mode ID is required'],
      index: true,
    },
    tableName: {
      type: String,
      required: [true, 'Table name is required'],
      trim: true,
    },
    gameType: {
      type: String,
      enum: ["Texas Hold'em", 'Omaha', 'Seven-Card Stud', 'Razz', 'Five-Card Draw'],
      required: [true, 'Game type is required'],
    },
    bType: {
      type: String,
      enum: ['blinds', 'antes'],
      required: [true, 'Betting type is required'],
    },
    mode: {
      type: String,
      enum: ['cash', 'practice'],
      default: 'cash',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
      required: true,
    },
    stake: {
      type: Number,
      required: [true, 'Stake is required'],
      min: [1, 'Stake must be at least 1'],
    },
    minBuyIn: {
      type: Number,
      required: [true, 'Minimum buy-in is required'],
    },
    maxBuyIn: {
      type: Number,
      required: [true, 'Maximum buy-in is required'],
    },
    minPlayerCount: {
      type: Number,
      required: [true, 'Minimum player count is required'],
      min: [2, 'Minimum players must be at least 2'],
      default: 2,
    },
    maxPlayerCount: {
      type: Number,
      required: [true, 'Maximum player count is required'],
      max: [9, 'Maximum players cannot exceed 9'],
      default: 6,
    },
    maxSeats: {
      type: Number,
      required: [true, 'Max seats is required'],
      max: [9, 'Max seats cannot exceed 9'],
    },
    seats: { type: [SeatSchema], default: [] },
    observers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    currentGame: { type: PokerGameSchema, default: null },
    currentGameStatus: {
      type: String,
      enum: ['waiting', 'in-progress', 'finished'],
      default: 'waiting',
    },
    totalBuyIns: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

PokerDeskSchema.index({ pokerModeId: 1, status: 1 });
PokerDeskSchema.index({ status: 1, currentGameStatus: 1 });

PokerDeskSchema.pre('save', function (next) {
  if (this.maxPlayerCount < this.minPlayerCount) {
    return next(new Error('Max player count cannot be less than min player count.'));
  }
  if (this.maxBuyIn <= this.minBuyIn) {
    return next(new Error('Max buy-in must be greater than min buy-in.'));
  }
  next();
});

PokerDeskSchema.methods.isUserSeated = function (userId: Types.ObjectId): boolean {
  return this.seats.some((s: ISeat) => s.userId.equals(userId));
};

PokerDeskSchema.methods.addObserver = async function (userId: Types.ObjectId): Promise<void> {
  const alreadyObserving = this.observers.some((id: Types.ObjectId) => id.equals(userId));
  if (!alreadyObserving) {
    this.observers.push(userId);
    await this.save();
  }
};

PokerDeskSchema.methods.removeObserver = async function (userId: Types.ObjectId): Promise<void> {
  this.observers = this.observers.filter(
    (id: Types.ObjectId) => !id.equals(userId)
  ) as Types.Array<Types.ObjectId>;
  await this.save();
};

PokerDeskSchema.methods.updateSeatStatus = async function (
  userId: Types.ObjectId,
  status: SeatStatus
): Promise<void> {
  const isGameActive =
    this.currentGame && this.currentGame.status === 'in-progress';

  if (status === 'disconnected' && !isGameActive) {
    await this.userLeavesSeat(userId);
    return;
  }

  const seat = this.seats.find((s: ISeat) => s.userId.equals(userId));
  if (seat) seat.status = status;
  await this.save();
};

PokerDeskSchema.methods.addUserToSeat = async function (
  userId: Types.ObjectId,
  buyInAmount: number
): Promise<ISeat> {
  if (!userId || !buyInAmount) throw new Error('User ID and buy-in amount are required.');
  if (buyInAmount < this.minBuyIn || buyInAmount > this.maxBuyIn) {
    throw new Error('Buy-in amount is outside the allowed range.');
  }
  if (this.seats.length >= this.maxSeats) throw new Error('No available seats.');
  if (this.isUserSeated(userId)) throw new Error('User is already seated.');

  if (this.mode === 'cash') {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error('Wallet not found.');
    if (wallet.balance < buyInAmount) throw new Error('Insufficient balance.');

    wallet.balance -= buyInAmount;
    await wallet.save();

    await WalletTransaction.create({
      walletId: wallet._id,
      type: 'deskIn',
      status: 'completed',
      amount: {
        cashAmount: buyInAmount,
        instantBonus: 0,
        lockedBonus: 0,
        gst: 0,
        tds: 0,
        otherDeductions: 0,
        total: buyInAmount,
      },
      remark: `Joined table ${this.tableName}`,
      deskId: this._id,
      createdOn: new Date(),
      completedOn: new Date(),
    });
  }

  const seatNumber = this.seats.length + 1;
  const newSeat: ISeat = {
    seatNumber,
    userId,
    buyInAmount,
    balanceAtTable: buyInAmount,
    status: 'active',
  };

  this.seats.push(newSeat);
  this.totalBuyIns += buyInAmount;
  await this.save();
  return newSeat;
};

PokerDeskSchema.methods.addWalletBalance = async function (
  userId: Types.ObjectId,
  amount: number
): Promise<void> {
  if (!userId || !amount) throw new Error('Required fields missing.');
  if (amount < this.minBuyIn || amount > this.maxBuyIn) {
    throw new Error('Amount is outside the allowed range.');
  }

  const seat = this.seats.find((s: ISeat) => s.userId.equals(userId));
  if (!seat) throw new Error('User is not seated.');

  if (this.mode === 'cash') {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error('Wallet not found.');
    if (wallet.balance < amount) throw new Error('Insufficient balance.');

    wallet.balance -= amount;
    await wallet.save();

    await WalletTransaction.create({
      walletId: wallet._id,
      type: 'deskIn',
      status: 'completed',
      amount: {
        cashAmount: amount,
        instantBonus: 0,
        lockedBonus: 0,
        gst: 0,
        tds: 0,
        otherDeductions: 0,
        total: amount,
      },
      remark: `Added balance at table ${this.tableName}`,
      deskId: this._id,
      createdOn: new Date(),
      completedOn: new Date(),
    });
  }

  seat.balanceAtTable += amount;
  this.totalBuyIns += amount;
  await this.save();
};

PokerDeskSchema.methods.userLeavesSeat = async function (
  userId: Types.ObjectId
): Promise<number> {
  const seat = this.seats.find((s: ISeat) => s.userId.equals(userId));
  if (!seat) throw new Error('User is not seated.');

  const amountToReturn = Math.round(seat.balanceAtTable * 100) / 100;

  if (this.mode === 'cash' && amountToReturn > 0) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error('Wallet not found.');

    wallet.balance += amountToReturn;
    await wallet.save();

    await WalletTransaction.create({
      walletId: wallet._id,
      type: 'deskWithdraw',
      status: 'completed',
      amount: {
        cashAmount: amountToReturn,
        instantBonus: 0,
        lockedBonus: 0,
        gst: 0,
        tds: 0,
        otherDeductions: 0,
        total: amountToReturn,
      },
      remark: `Left table ${this.tableName}`,
      deskId: this._id,
      createdOn: new Date(),
      completedOn: new Date(),
    });
  }

  const seatNumber = seat.seatNumber;
  this.seats = this.seats.filter(
    (s: ISeat) => !s.userId.equals(userId)
  ) as Types.DocumentArray<ISeat & Types.Subdocument>;
  await this.save();
  return seatNumber;
};

// PokerDeskSchema.methods.createGameFromTable = async function (): Promise<IPokerGame> {
//   if (this.currentGame && this.currentGame.status !== 'finished') {
//     throw new Error('An active game already exists.');
//   }

//   const activePlayers = this.seats
//     .filter((s: ISeat) => s.status === 'active' && s.balanceAtTable >= this.minBuyIn)
//     .map((s: ISeat) => ({
//       userId: s.userId,
//       balanceAtTable: s.balanceAtTable,
//       status: 'active' as PlayerStatus,
//       totalBet: 0,
//       holeCards: [],
//       role: 'player' as PlayerRole,
//     }));

//   if (activePlayers.length < this.minPlayerCount) {
//     throw new Error(`Not enough players. Need at least ${this.minPlayerCount}.`);
//   }

//   const isBlinds = this.bType === 'blinds';
//   const smallBlindAmount = isBlinds ? this.stake : 0;
//   const bigBlindAmount = isBlinds ? this.stake * 2 : 0;
//   const anteAmount = isBlinds ? 0 : this.stake;
//   const holeCardsCount = this.gameType === 'Omaha' ? 4 : this.gameType === 'Seven-Card Stud' ? 7 : 2;

//   if (isBlinds) {
//     activePlayers[0].role = 'sb';
//     activePlayers[1].role = 'bb';
//     activePlayers[0].totalBet = smallBlindAmount;
//     activePlayers[1].totalBet = bigBlindAmount;
//     activePlayers[0].balanceAtTable -= smallBlindAmount;
//     activePlayers[1].balanceAtTable -= bigBlindAmount;
//   } else {
//     activePlayers.forEach((p: IGamePlayer) => {
//       p.balanceAtTable -= anteAmount;
//       p.totalBet += anteAmount;
//     });
//   }

//   const initialPot = activePlayers.reduce((sum: number, p: IGamePlayer) => sum + p.totalBet, 0);
//   const deck = generateDeck();
//   activePlayers.forEach(
//     (p: IGamePlayer) =>
//       (p.holeCards = Array.from({ length: holeCardsCount }, () => deck.pop()!))
//   );

//   const initialActions: IPlayerActionRecord[] = isBlinds
//     ? [
//         { userId: activePlayers[0].userId, action: 'small-blind', amount: smallBlindAmount, timestamp: new Date() },
//         { userId: activePlayers[1].userId, action: 'big-blind', amount: bigBlindAmount, timestamp: new Date() },
//       ]
//     : activePlayers.map((p: IGamePlayer) => ({
//         userId: p.userId,
//         action: 'ante' as IPlayerActionRecord['action'],
//         amount: anteAmount,
//         timestamp: new Date(),
//       }));

//   this.currentGame = {
//     players: activePlayers,
//     currentTurnPlayer: isBlinds
//       ? activePlayers[2]?.userId || activePlayers[0].userId
//       : activePlayers[0].userId,
//     totalBet: initialPot,
//     pots: [],
//     status: 'in-progress',
//     rounds: [{ name: 'pre-flop', bettingRoundStartedAt: new Date(), actions: initialActions }],
//     communityCards: [],
//   } as any;

//   this.currentGameStatus = 'in-progress';

//   this.seats.forEach((seat: ISeat) => {
//     const matchingPlayer = activePlayers.find((p: IGamePlayer) => p.userId.equals(seat.userId));
//     if (matchingPlayer) {
//       seat.balanceAtTable = matchingPlayer.balanceAtTable;
//     } else if (seat.balanceAtTable < this.minBuyIn) {
//       this.seats = this.seats.filter(
//         (s: ISeat) => !s.userId.equals(seat.userId)
//       ) as Types.DocumentArray<ISeat & Types.Subdocument>;
//     }
//   });

//   await this.save();
//   return this.currentGame!;
// };
PokerDeskSchema.methods.createGameFromTable = async function (): Promise<IPokerGame> {
  if (this.currentGame && this.currentGame.status !== 'finished') {
    throw new Error('An active game already exists.');
  }

  const eligibleSeats = this.seats.filter(
    (s: ISeat) => s.status === 'active' && s.balanceAtTable >= this.minBuyIn
  );

  if (eligibleSeats.length < this.minPlayerCount) {
    throw new Error(`Not enough players. Need at least ${this.minPlayerCount}.`);
  }

  const initialState = initializeGameState(
    eligibleSeats,
    this.bType,
    this.stake,
    this.gameType,
    this.minBuyIn
  );

  this.currentGame = {
    players: initialState.players,
    currentTurnPlayer: initialState.currentTurnPlayer,
    totalBet: initialState.totalBet,
    pots: initialState.pots,
    status: 'in-progress',
    rounds: initialState.rounds,
    communityCards: initialState.communityCards,
  } as any;

  this.currentGameStatus = 'in-progress';

  this.seats.forEach((seat: ISeat) => {
    const matchingPlayer = initialState.players.find((p) =>
      p.userId.equals(seat.userId)
    );
    if (matchingPlayer) {
      seat.balanceAtTable = matchingPlayer.balanceAtTable;
    } else if (seat.balanceAtTable < this.minBuyIn) {
      this.seats = this.seats.filter(
        (s: ISeat) => !s.userId.equals(seat.userId)
      ) as Types.DocumentArray<ISeat & Types.Subdocument>;
    }
  });

  await this.save();
  return this.currentGame!;
};

// PokerDeskSchema.methods.handlePlayerAction = async function (
//   userId: Types.ObjectId,
//   action: PlayerAction,
//   amount: number = 0
// ): Promise<IPlayerActionRecord> {
//   if (!this.currentGame?.currentTurnPlayer?.equals(userId)) {
//     throw new Error('It is not this player\'s turn.');
//   }

//   const seat = this.seats.find((s: ISeat) => s.userId.equals(userId));
//   const player = this.currentGame.players.find((p: IGamePlayer) => p.userId.equals(userId));
//   if (!player || !seat) throw new Error('Player or seat not found.');

//   const currentRound = this.currentGame.rounds[this.currentGame.rounds.length - 1];
//   if (!currentRound || currentRound.name === 'showdown') {
//     throw new Error('No active betting round.');
//   }

//   let maxBet = 0;
//   const playerBets = currentRound.actions.reduce((acc: Record<string, number>, act: IPlayerActionRecord) => {
//     const key = act.userId.toString();
//     acc[key] = (acc[key] || 0) + act.amount;
//     maxBet = Math.max(maxBet, acc[key]);
//     return acc;
//   }, {});

//   const playerTotalBet = playerBets[userId.toString()] || 0;
//   const callAmount = Math.max(0, maxBet - playerTotalBet);

//   const actionRecord: IPlayerActionRecord = {
//     userId,
//     action: 'fold',
//     amount: 0,
//     timestamp: new Date(),
//   };

//   if (action === 'fold') {
//     player.status = 'folded';
//     actionRecord.action = 'fold';
//   } else if (action === 'check' && callAmount === 0) {
//     actionRecord.action = 'check';
//   } else if (['call', 'raise', 'all-in'].includes(action)) {
//     let finalAmount = action === 'raise' ? amount : callAmount;

//     if (action === 'all-in' || finalAmount >= player.balanceAtTable) {
//       finalAmount = player.balanceAtTable;
//       actionRecord.action =
//         callAmount === 0 && finalAmount === 0 ? 'check' : 'all-in';
//       if (actionRecord.action === 'all-in') player.status = 'all-in';
//     } else {
//       actionRecord.action = finalAmount === callAmount ? 'call' : 'raise';
//     }

//     player.balanceAtTable -= finalAmount;
//     player.totalBet += finalAmount;
//     seat.balanceAtTable -= finalAmount;
//     this.currentGame.totalBet += finalAmount;
//     actionRecord.amount = finalAmount;
//   } else {
//     throw new Error('Invalid action.');
//   }

//   currentRound.actions.push(actionRecord as any);

//   const activePlayers = this.currentGame.players.filter(
//     (p: IGamePlayer) => p.status === 'active' || p.status === 'all-in'
//   );

//   if (activePlayers.length <= 1) {
//     await this.showdown();
//   } else {
//     const nextPlayerId = this.currentGame.getNextActivePlayer(userId);

//     if (!nextPlayerId) {
//       await this.showdown();
//       await this.save();
//       return actionRecord;
//     }

//     const actionPlayerIds = new Set(
//       currentRound.actions.map((a: IPlayerActionRecord) => a.userId.toString())
//     );

//     if (!actionPlayerIds.has(nextPlayerId.toString())) {
//       this.currentGame.currentTurnPlayer = nextPlayerId;
//     } else {
//       const totalBets = currentRound.actions.reduce(
//         (acc: Record<string, number>, act: IPlayerActionRecord) => {
//           const key = act.userId.toString();
//           acc[key] = (acc[key] || 0) + act.amount;
//           return acc;
//         },
//         {}
//       );

//       const uniqueBets = new Set(Object.values(totalBets));
//       const activeOnlyCount = activePlayers.filter(
//         (p: IGamePlayer) => p.status === 'active'
//       ).length;

//       if (
//         uniqueBets.size === 1 &&
//         (currentRound.name === 'river' || activeOnlyCount === 1)
//       ) {
//         await this.showdown();
//       } else if (uniqueBets.size === 1) {
//         await this.currentGame.startNextRound(currentRound.name);
//       } else {
//         this.currentGame.currentTurnPlayer = nextPlayerId;
//       }
//     }
//   }

//   await this.save();
//   return actionRecord;
// };
PokerDeskSchema.methods.handlePlayerAction = async function (
  userId: Types.ObjectId,
  action: PlayerAction,
  amount: number = 0
): Promise<IPlayerActionRecord> {
  if (!this.currentGame?.currentTurnPlayer?.equals(userId)) {
    throw new Error('It is not this player\'s turn.');
  }

  const seat = this.seats.find((s: ISeat) => s.userId.equals(userId));
  const playerIndex = this.currentGame.players.findIndex(
    (p: IGamePlayer) => p.userId.equals(userId)
  );
  if (playerIndex === -1 || !seat) throw new Error('Player or seat not found.');

  const player = this.currentGame.players[playerIndex];
  const currentRound = this.currentGame.rounds[this.currentGame.rounds.length - 1];
  if (!currentRound || currentRound.name === 'showdown') {
    throw new Error('No active betting round.');
  }

  const { actionRecord, updatedPlayer, updatedSeatBalance, updatedTotalBet } =
    processPlayerAction(player, seat.balanceAtTable, this.currentGame.totalBet, currentRound, action, amount);

  this.currentGame.players[playerIndex] = updatedPlayer;
  seat.balanceAtTable = updatedSeatBalance;
  this.currentGame.totalBet = updatedTotalBet;
  currentRound.actions.push(actionRecord as any);

  const progression = determineRoundProgression(
    this.currentGame.players,
    currentRound,
    userId
  );

  if (progression.type === 'showdown') {
    await this.showdown();
  } else if (progression.type === 'nextRound') {
    await this.currentGame.startNextRound(currentRound.name);
  } else {
    this.currentGame.currentTurnPlayer = progression.nextPlayerId;
  }

  await this.save();
  return actionRecord;
};

// PokerDeskSchema.methods.showdown = async function (): Promise<void> {
//   if (!this.currentGame || this.currentGame.status !== 'in-progress') {
//     throw new Error('No active game to end.');
//   }

//   const gamePots = createPots(this.currentGame.rounds);
//   const potResults = evaluatePots(
//     this.currentGame.players,
//     this.currentGame.communityCards,
//     gamePots,
//     this.gameType
//   );

//   this.currentGame.pots = potResults as any;

//   for (const pot of potResults) {
//     for (const winner of pot.winners) {
//       const seat = this.seats.find((s: ISeat) => s.userId.equals(winner.playerId));
//       if (seat) seat.balanceAtTable += winner.amount;
//     }
//   }

//   const archivePlayers = this.currentGame.players.map((p: IGamePlayer) => {
//     const seat = this.seats.find((s: ISeat) => s.userId.equals(p.userId));
//     const isWinner = potResults.some((pot: any) =>
//       pot.winners.some((w: IPotWinner) => w.playerId.equals(p.userId))
//     );
//     return {
//       userId: p.userId,
//       username: '',
//       seatNumber: seat?.seatNumber || 0,
//       startingStack: seat?.buyInAmount || 0,
//       endingStack: seat?.balanceAtTable || 0,
//       totalBet: p.totalBet,
//       isWinner,
//     };
//   });

//   const archivePots = potResults.map((pot: any, index: number) => ({
//     potNumber: index + 1,
//     totalAmount: pot.amount,
//     winners: pot.winners.map((w: IPotWinner) => ({
//       playerId: w.playerId,
//       username: '',
//       amount: w.amount,
//       handDescription: '',
//     })),
//   }));

//   await PokerGameArchive.create({
//     deskId: this._id,
//     pokerModeId: this.pokerModeId,
//     gameType: this.gameType,
//     players: archivePlayers,
//     pots: archivePots,
//     totalPot: this.currentGame.totalBet,
//     startedAt: this.currentGame.createdAt,
//     completedAt: new Date(),
//   });

//   this.currentGame.status = 'finished';
//   this.currentGameStatus = 'finished';

//   for (const player of this.currentGame.players) {
//     const seat = this.seats.find((s: ISeat) => s.userId.equals(player.userId));
//     if (seat?.status === 'disconnected') {
//       await this.userLeavesSeat(player.userId);
//     }
//   }

//   await this.save();
// };
PokerDeskSchema.methods.showdown = async function (): Promise<void> {
  if (!this.currentGame || this.currentGame.status !== 'in-progress') {
    throw new Error('No active game to end.');
  }

  const gamePots = createPots(this.currentGame.rounds);
  const potResults = evaluatePots(
    this.currentGame.players,
    this.currentGame.communityCards,
    gamePots,
    this.gameType
  );

  this.currentGame.pots = potResults as any;

  for (const pot of potResults) {
    for (const winner of pot.winners) {
      const seat = this.seats.find((s: ISeat) => s.userId.equals(winner.playerId));
      if (seat) seat.balanceAtTable += winner.amount;
    }
  }

  const archiveData = buildArchiveData(
    this.seats,
    this.currentGame.players,
    potResults,
    this.currentGame.totalBet,
    this.currentGame.createdAt
  );

  await PokerGameArchive.create({
    deskId: this._id,
    pokerModeId: this.pokerModeId,
    gameType: this.gameType,
    ...archiveData,
  });

  this.currentGame.status = 'finished';
  this.currentGameStatus = 'finished';

  for (const player of this.currentGame.players) {
    const seat = this.seats.find((s: ISeat) => s.userId.equals(player.userId));
    if (seat?.status === 'disconnected') {
      await this.userLeavesSeat(player.userId);
    }
  }

  await this.save();
};

const PokerDesk: Model<IPokerDeskDocument> =
  mongoose.models.PokerDesk ||
  mongoose.model<IPokerDeskDocument>('PokerDesk', PokerDeskSchema);

export default PokerDesk;