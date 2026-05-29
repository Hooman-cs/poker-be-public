/**
 * @fileoverview Poker Desk Model (schema only)
 * Represents the persistent state of a poker table: seats, observers, and the
 * embedded current game. This file is now SCHEMA + VALIDATION ONLY.
 *
 * All game logic (creating a game, handling actions, advancing rounds, showdown)
 * and all wallet/persistence orchestration live in src/services/gameService.ts,
 * which calls the pure functions in src/engine/. The model no longer carries
 * methods — it is a plain, validated data container.
 *
 * All money fields (buyIn, balances, bets, pots) are INTEGER minor units.
 */

import mongoose, { Schema, Document, Types, Model } from 'mongoose';
import { PokerGameType } from '@/models/poker';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, Currency } from '@/config/constants';

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
  /** Buy-in amount, minor units. */
  buyInAmount: number;
  /** Current balance at the table, minor units. */
  balanceAtTable: number;
  status: SeatStatus;
}

export interface IGamePlayer {
  userId: Types.ObjectId;
  /** Balance at the table for this hand, minor units. */
  balanceAtTable: number;
  status: PlayerStatus;
  /** Total bet this hand, minor units. */
  totalBet: number;
  holeCards: ICard[];
  role: PlayerRole;
}

export interface IPlayerActionRecord {
  userId: Types.ObjectId;
  action: PlayerAction | 'small-blind' | 'big-blind' | 'ante';
  /** Amount for this action, minor units. */
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
  /** Contribution to this pot, minor units. */
  contribution: number;
}

export interface IPotWinner {
  playerId: Types.ObjectId;
  /** Amount won from this pot, minor units. */
  amount: number;
}

export interface IGamePot {
  /** Pot size, minor units. */
  amount: number;
  contributors: IPotContributor[];
  winners: IPotWinner[];
}

export interface IPokerGame {
  players: IGamePlayer[];
  currentTurnPlayer: Types.ObjectId | null;
  /** Total wagered in the current game, minor units. */
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
  currency: Currency;
  status: DeskStatus;
  /** Stake, minor units (small blind for blinds games, ante for antes games). */
  stake: number;
  /** Minimum buy-in, minor units. */
  minBuyIn: number;
  /** Maximum buy-in, minor units. */
  maxBuyIn: number;
  minPlayerCount: number;
  maxPlayerCount: number;
  maxSeats: number;
  seats: ISeat[];
  observers: Types.ObjectId[];
  currentGame: IPokerGame | null;
  currentGameStatus: GameStatus;
  /** Cumulative all-time buy-ins counter, minor units (not decremented on leave). */
  totalBuyIns: number;
}

/**
 * Document type. Note: NO methods. All behavior lives in gameService.
 * The embedded currentGame is a plain object on the document.
 */
export interface IPokerDeskDocument
  extends Omit<IPokerDesk, 'seats' | 'observers' | 'currentGame'>,
    Document {
  seats: Types.DocumentArray<ISeat & Types.Subdocument>;
  observers: Types.Array<Types.ObjectId>;
  currentGame: IPokerGame | null;
}

const SeatSchema = new Schema<ISeat & Types.Subdocument>(
  {
    seatNumber: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    buyInAmount: { type: Number, default: 0, min: 0 },
    balanceAtTable: { type: Number, default: 0, min: 0 },
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
    balanceAtTable: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['active', 'all-in', 'folded', 'sitting-out'],
      default: 'active',
    },
    totalBet: { type: Number, default: 0, min: 0 },
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
    amount: { type: Number, default: 0, min: 0 },
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
    contribution: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false }
);

const PotWinnerSchema = new Schema<IPotWinner>(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false }
);

const PotSchema = new Schema<IGamePot>(
  {
    amount: { type: Number, required: true, default: 0, min: 0 },
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

const PokerGameSchema = new Schema<IPokerGame>(
  {
    players: { type: [PlayerSchema], default: [] },
    currentTurnPlayer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    totalBet: { type: Number, default: 0, min: 0 },
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
    currency: {
      type: String,
      enum: SUPPORTED_CURRENCIES,
      default: DEFAULT_CURRENCY,
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
      min: [1, 'Stake must be at least 1 minor unit'],
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
    totalBuyIns: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

PokerDeskSchema.index({ pokerModeId: 1, status: 1 });
PokerDeskSchema.index({ status: 1, currentGameStatus: 1 });

/** Structural validation (player-count and buy-in sanity), plus integer-money guard. */
PokerDeskSchema.pre('save', function (next) {
  if (this.maxPlayerCount < this.minPlayerCount) {
    return next(new Error('Max player count cannot be less than min player count.'));
  }
  if (this.maxBuyIn <= this.minBuyIn) {
    return next(new Error('Max buy-in must be greater than min buy-in.'));
  }
  for (const f of ['stake', 'minBuyIn', 'maxBuyIn', 'totalBuyIns'] as const) {
    if (!Number.isInteger(this[f])) {
      return next(new Error(`PokerDesk.${f} must be an integer (minor units); got ${this[f]}`));
    }
  }
  next();
});

const PokerDesk: Model<IPokerDeskDocument> =
  mongoose.models.PokerDesk ||
  mongoose.model<IPokerDeskDocument>('PokerDesk', PokerDeskSchema);

export default PokerDesk;