/**
 * @fileoverview Poker Mode Model
 * Defines stakes and buy-in configurations for a poker game type.
 * Each poker game can have multiple modes with different stakes.
 * bType is auto-set based on the parent Poker game type.
 * minPlayerCount and maxPlayerCount live on PokerDesk as they are table level settings.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { PokerGameType } from '@/models/poker';

export type BettingType = 'blinds' | 'antes';
export type PokerModeStatus = 'active' | 'disabled';
export type PokerModeType = 'cash' | 'practice';

const BLINDS_GAMES: PokerGameType[] = ["Texas Hold'em", 'Omaha'];
const ANTES_GAMES: PokerGameType[] = ['Seven-Card Stud', 'Razz', 'Five-Card Draw'];

export interface IPokerMode {
  pokerId: mongoose.Types.ObjectId;
  gameType: PokerGameType;
  bType: BettingType;
  stake: number;
  minBuyIn: number;
  maxBuyIn: number;
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
      min: [1, 'Stake must be at least 1'],
    },
    minBuyIn: {
      type: Number,
      required: [true, 'Minimum buy-in is required'],
      min: [1, 'Minimum buy-in must be at least 1'],
    },
    maxBuyIn: {
      type: Number,
      required: [true, 'Maximum buy-in is required'],
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

// Auto-set bType based on gameType before saving
PokerModeSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('gameType')) {
    if (BLINDS_GAMES.includes(this.gameType)) {
      this.bType = 'blinds';
    } else if (ANTES_GAMES.includes(this.gameType)) {
      this.bType = 'antes';
    }
  }
  next();
});

// Validate maxBuyIn is greater than minBuyIn
PokerModeSchema.pre('save', function (next) {
  if (this.maxBuyIn <= this.minBuyIn) {
    return next(
      new Error('Maximum buy-in must be greater than minimum buy-in')
    );
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
// /**
//  * @fileoverview Poker Mode Database Model
//  * Defines the rules, stakes, and buy-ins for a specific poker variant.
//  */

// import mongoose, { Document, Schema, Model } from 'mongoose';
// import { IPokerMode } from '@/utils/pokerModelTypes';

// // 1. Strict Types for the Mongoose Document
// // We omit _id and pokerId to prevent collisions and enforce strict ObjectIds
// export interface IPokerModeDocument extends Omit<IPokerMode, '_id' | 'pokerId'>, Document {
//   pokerId: mongoose.Types.ObjectId;
// }

// // 2. Schema Definition
// const pokerModeSchema = new Schema<IPokerModeDocument>({
//   pokerId: {
//     type: Schema.Types.ObjectId,
//     ref: 'Poker',
//     required: true,
//   },
//   mode: {
//     type: String,
//     enum: ['practice', 'cash'],
//     default: 'cash',
//     required: true,
//   },
//   stake: {
//     type: Number,
//     required: true, // Required for both Blinds and Antes
//   },
//   minBuyIn: {
//     type: Number,
//     required: true,
//   },
//   maxBuyIn: {
//     type: Number,
//     required: true,
//   },
//   bType: {
//     type: String,
//     enum: ['blinds', 'antes', 'both'], // Updated to match global interface
//     required: true,
//   },
//   status: {
//     type: String,
//     enum: ['active', 'disable'],
//     default: 'active',
//     required: true,
//   }, 
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// // 3. Pre-save Hook: Auto-update timestamps
// pokerModeSchema.pre<IPokerModeDocument>('save', function (next) {
//   this.updatedAt = new Date();
//   next();
// });

// // 4. Model Export (Standardized casing)
// const PokerMode: Model<IPokerModeDocument> = 
//   mongoose.models.PokerMode || mongoose.model<IPokerModeDocument>('PokerMode', pokerModeSchema);

// export default PokerMode;