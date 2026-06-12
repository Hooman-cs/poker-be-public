/**
 * @fileoverview Poker Game Archive Model
 * Records completed poker games for admin analytics and user game history.
 * Hand history is intentionally excluded (too large, unused). If needed later,
 * it should be a separate collection.
 *
 * All money (stacks, bets, pots, winnings) is INTEGER minor units (paise/cents).
 * username on players and winners is REQUIRED; the showdown logic in pokerDesk.ts
 * resolves real usernames before creating an archive (see task 0.8).
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { PokerGameType } from '@/models/poker';
import { ModeType } from '@/models/pokerDesk';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, Currency } from '@/config/constants';

export interface IGamePlayer {
  userId: mongoose.Types.ObjectId;
  username: string;
  seatNumber: number;
  /** Stack at the start of the game, minor units. */
  startingStack: number;
  /** Stack at the end of the game, minor units. */
  endingStack: number;
  /** Total amount this player bet across the game, minor units. */
  totalBet: number;
  isWinner: boolean;
}

export interface IPotWinner {
  playerId: mongoose.Types.ObjectId;
  username: string;
  /** Amount won from this pot, minor units. */
  amount: number;
  handDescription: string;
}

export interface IGamePot {
  potNumber: number;
  /** Total size of this pot, minor units. */
  totalAmount: number;
  winners: IPotWinner[];
}

export interface IPokerGameArchive {
  deskId: mongoose.Types.ObjectId;
  pokerModeId: mongoose.Types.ObjectId;
  gameType: PokerGameType;
  currency: Currency;
  mode: ModeType;
  players: IGamePlayer[];
  pots: IGamePot[];
  /** Total pot across the whole game, minor units. */
  totalPot: number;
  startedAt: Date;
  completedAt: Date;
}

export interface IPokerGameArchiveDocument extends IPokerGameArchive, Document {}

const GamePlayerSchema = new Schema<IGamePlayer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    seatNumber: { type: Number, required: true },
    startingStack: { type: Number, required: true, min: 0 },
    endingStack: { type: Number, required: true, min: 0 },
    totalBet: { type: Number, required: true, min: 0 },
    isWinner: { type: Boolean, default: false },
  },
  { _id: false }
);

const PotWinnerSchema = new Schema<IPotWinner>(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    handDescription: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const GamePotSchema = new Schema<IGamePot>(
  {
    potNumber: { type: Number, required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    winners: { type: [PotWinnerSchema], default: [] },
  },
  { _id: false }
);

const PokerGameArchiveSchema = new Schema<IPokerGameArchiveDocument>(
  {
    deskId: {
      type: Schema.Types.ObjectId,
      ref: 'PokerDesk',
      required: [true, 'Desk ID is required'],
      index: true,
    },
    pokerModeId: {
      type: Schema.Types.ObjectId,
      ref: 'PokerMode',
      required: [true, 'Poker mode ID is required'],
      index: true,
    },
    gameType: {
      type: String,
      enum: [
        "Texas Hold'em",
        'Omaha',
        'Seven-Card Stud',
        'Razz',
        'Five-Card Draw',
      ],
      required: [true, 'Game type is required'],
    },
    currency: {
      type: String,
      enum: SUPPORTED_CURRENCIES,
      default: DEFAULT_CURRENCY,
      required: true,
    },
    mode: {
      type: String,
      enum: ['cash', 'practice'],
      required: true,
    },
    players: { type: [GamePlayerSchema], default: [] },
    pots: { type: [GamePotSchema], default: [] },
    totalPot: { type: Number, required: true, min: 0, default: 0 },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

/**
 * Guard: all money fields (across nested players/pots/winners) must be whole
 * minor units. Protects the analytics/history surfaces from float corruption.
 */
PokerGameArchiveSchema.pre('save', function (next) {
  if (!Number.isInteger(this.totalPot)) {
    return next(new Error(`PokerGameArchive.totalPot must be an integer (minor units); got ${this.totalPot}`));
  }
  for (const p of this.players) {
    for (const f of ['startingStack', 'endingStack', 'totalBet'] as const) {
      if (!Number.isInteger(p[f])) {
        return next(new Error(`PokerGameArchive player.${f} must be an integer (minor units); got ${p[f]}`));
      }
    }
  }
  for (const pot of this.pots) {
    if (!Number.isInteger(pot.totalAmount)) {
      return next(new Error(`PokerGameArchive pot.totalAmount must be an integer (minor units); got ${pot.totalAmount}`));
    }
    for (const w of pot.winners) {
      if (!Number.isInteger(w.amount)) {
        return next(new Error(`PokerGameArchive winner.amount must be an integer (minor units); got ${w.amount}`));
      }
    }
  }
  next();
});

PokerGameArchiveSchema.index({ 'players.userId': 1, completedAt: -1 });
PokerGameArchiveSchema.index({ deskId: 1, completedAt: -1 });
PokerGameArchiveSchema.index({ pokerModeId: 1, completedAt: -1 });
PokerGameArchiveSchema.index({ gameType: 1, completedAt: -1 });

const PokerGameArchive: Model<IPokerGameArchiveDocument> =
  mongoose.models.PokerGameArchive ||
  mongoose.model<IPokerGameArchiveDocument>('PokerGameArchive', PokerGameArchiveSchema);

export default PokerGameArchive;