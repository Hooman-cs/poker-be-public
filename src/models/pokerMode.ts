/**
 * @fileoverview Poker Mode Model
 * Defines stakes and buy-in configuration for a poker game type.
 * Each poker game can have multiple modes with different stakes.
 * bType is auto-set from the parent Poker game type (blinds vs antes).
 * minPlayerCount / maxPlayerCount live on PokerDesk (table-level settings).
 *
 * stake, minBuyIn, maxBuyIn are stored in INTEGER minor units (paise/cents).
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { PokerGameType } from '@/models/poker';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, Currency } from '@/config/constants';

export type BettingType = 'blinds' | 'antes';
export type PokerModeStatus = 'active' | 'disabled';
export type PokerModeType = 'cash' | 'practice';

const BLINDS_GAMES: PokerGameType[] = ["Texas Hold'em", 'Omaha'];
const ANTES_GAMES: PokerGameType[] = ['Seven-Card Stud', 'Razz', 'Five-Card Draw'];

export interface IPokerMode {
  pokerId: mongoose.Types.ObjectId;
  gameType: PokerGameType;
  bType: BettingType;
  /** Stake (small blind for blinds games, ante for antes games), minor units. */
  stake: number;
  /** Minimum buy-in, minor units. */
  minBuyIn: number;
  /** Maximum buy-in, minor units. */
  maxBuyIn: number;
  /** Currency this mode is denominated in; inherited by its desks. */
  currency: Currency;
  mode: PokerModeType;
  status: PokerModeStatus;
}

export interface IPokerModeDocument extends IPokerMode, Document {}

const PokerModeSchema = new Schema<IPokerModeDocument>(
  {
    pokerId: {
      type: Schema.Types.ObjectId,
      ref: 'Poker',
      required: [true, 'Poker ID is required'],
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
    bType: {
      type: String,
      enum: ['blinds', 'antes'],
      required: [true, 'Betting type is required'],
    },
    stake: {
      type: Number,
      required: [true, 'Stake is required'],
      min: [1, 'Stake must be at least 1 minor unit'],
    },
    minBuyIn: {
      type: Number,
      required: [true, 'Minimum buy-in is required'],
      min: [1, 'Minimum buy-in must be at least 1 minor unit'],
    },
    maxBuyIn: {
      type: Number,
      required: [true, 'Maximum buy-in is required'],
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
      default: 'cash',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

/** Auto-set bType from gameType before saving. */
PokerModeSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('gameType')) {
    if (BLINDS_GAMES.includes(this.gameType)) {
      this.bType = 'blinds';
    } else if (ANTES_GAMES.includes(this.gameType)) {
      this.bType = 'antes';
    }
  }
  next();
});

/** Validate money fields are whole minor units and maxBuyIn > minBuyIn. */
PokerModeSchema.pre('save', function (next) {
  for (const f of ['stake', 'minBuyIn', 'maxBuyIn'] as const) {
    if (!Number.isInteger(this[f])) {
      return next(new Error(`PokerMode.${f} must be an integer (minor units); got ${this[f]}`));
    }
  }
  if (this.maxBuyIn <= this.minBuyIn) {
    return next(new Error('Maximum buy-in must be greater than minimum buy-in'));
  }
  next();
});

PokerModeSchema.index({ pokerId: 1, status: 1 });
PokerModeSchema.index({ pokerId: 1, mode: 1 });
PokerModeSchema.index({ gameType: 1 });

const PokerMode: Model<IPokerModeDocument> =
  mongoose.models.PokerMode ||
  mongoose.model<IPokerModeDocument>('PokerMode', PokerModeSchema);

export default PokerMode;