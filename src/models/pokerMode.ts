/**
 * @fileoverview Poker Mode Database Model
 * Defines the rules, stakes, and buy-ins for a specific poker variant.
 */

import mongoose, { Document, Schema, Model } from 'mongoose';
import { IPokerMode } from '@/utils/pokerModelTypes';

// 1. Strict Types for the Mongoose Document
// We omit _id and pokerId to prevent collisions and enforce strict ObjectIds
export interface IPokerModeDocument extends Omit<IPokerMode, '_id' | 'pokerId'>, Document {
  pokerId: mongoose.Types.ObjectId;
}

// 2. Schema Definition
const pokerModeSchema = new Schema<IPokerModeDocument>({
  pokerId: {
    type: Schema.Types.ObjectId,
    ref: 'Poker',
    required: true,
  },
  mode: {
    type: String,
    enum: ['practice', 'cash'],
    default: 'cash',
    required: true,
  },
  stake: {
    type: Number,
    required: true, // Required for both Blinds and Antes
  },
  minBuyIn: {
    type: Number,
    required: true,
  },
  maxBuyIn: {
    type: Number,
    required: true,
  },
  bType: {
    type: String,
    enum: ['blinds', 'antes', 'both'], // Updated to match global interface
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'disable'],
    default: 'active',
    required: true,
  }, 
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// 3. Pre-save Hook: Auto-update timestamps
pokerModeSchema.pre<IPokerModeDocument>('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// 4. Model Export (Standardized casing)
const PokerMode: Model<IPokerModeDocument> = 
  mongoose.models.PokerMode || mongoose.model<IPokerModeDocument>('PokerMode', pokerModeSchema);

export default PokerMode;