/**
 * @fileoverview Poker Model
 * Defines the supported poker game types available on the platform.
 * Each game type can have multiple modes (PokerMode) with different stakes.
 * This is a small reference/config model — no money fields, no currency.
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

const Poker: Model<IPokerDocument> =
  mongoose.models.Poker ||
  mongoose.model<IPokerDocument>('Poker', PokerSchema);

export default Poker;