/**
 * @fileoverview Poker Model
 * Defines the supported poker game types available on the platform.
 * Each game type can have multiple modes with different stakes configurations.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export type PokerGameType =
  | "Texas Hold'em"
  | 'Omaha'
  | 'Seven-Card Stud'
  | 'Razz'
  | 'Five-Card Draw';

export type PokerStatus = 'active' | 'maintenance' | 'disabled';

export interface IPoker {
  gameType: PokerGameType;
  description?: string;
  objective?: string;
  status: PokerStatus;
}

export interface IPokerDocument extends IPoker, Document {}

const PokerSchema = new Schema<IPokerDocument>(
  {
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
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    objective: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'maintenance', 'disabled'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

PokerSchema.index({ status: 1 });
PokerSchema.index({ gameType: 1 });

const Poker: Model<IPokerDocument> =
  mongoose.models.Poker ||
  mongoose.model<IPokerDocument>('Poker', PokerSchema);

export default Poker;
// /**
//  * @fileoverview Master Poker Database Model
//  * Defines the foundational rules, types, and configurations of poker games available.
//  */

// import mongoose, { Document, Schema, Model } from 'mongoose';
// import { IPoker } from '@/utils/pokerModelTypes';

// // 1. Strict Types for the Mongoose Document
// // We omit _id and safely inherit the rest of the sanitized global interface
// export interface IPokerDocument extends Omit<IPoker, '_id'>, Document {}

// // 2. Schema Definition
// const pokerSchema = new Schema<IPokerDocument>({
//   name: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true,
//   },
//   objective: {
//     type: String,
//     default: 'Make the best 5-card hand',
//   },
//   rules: {
//     type: Map,
//     of: String,
//     default: {},
//   },
//   description: {
//     type: String,
//     trim: true,
//   },
//   status: {
//     type: String,
//     enum: ['active', 'maintenance', 'disable'],
//     default: 'active',
//   },
//   gameType: {
//     type: String,
//     enum: [
//       'NLH', 'PLO4', 'PLO5', 'OmahaHILO', 'SDH', 'STUD', 
//       'RAZZ', 'PINEAPPLE', 'COURCHEVEL', '5CD', 'BADUGI', 'MIXED'
//     ],
//     default: 'NLH',
//     required: true,
//   },
//   // Reconciled legacy field injected into the schema
//   blindsOrAntes: {
//     type: String,
//     enum: ['blinds', 'antes', 'both'],
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
// pokerSchema.pre<IPokerDocument>('save', function (next) {
//   this.updatedAt = new Date();
//   next();
// });

// // 4. Model Export
// const Poker: Model<IPokerDocument> = mongoose.models.Poker || mongoose.model<IPokerDocument>('Poker', pokerSchema);

// export default Poker;