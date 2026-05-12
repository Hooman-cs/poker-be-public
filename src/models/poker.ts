/**
 * @fileoverview Master Poker Database Model
 * Defines the foundational rules, types, and configurations of poker games available.
 */

import mongoose, { Document, Schema, Model } from 'mongoose';
import { IPoker } from '@/utils/pokerModelTypes';

// 1. Strict Types for the Mongoose Document
// We omit _id and safely inherit the rest of the sanitized global interface
export interface IPokerDocument extends Omit<IPoker, '_id'>, Document {}

// 2. Schema Definition
const pokerSchema = new Schema<IPokerDocument>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  objective: {
    type: String,
    default: 'Make the best 5-card hand',
  },
  rules: {
    type: Map,
    of: String,
    default: {},
  },
  description: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'disable'],
    default: 'active',
  },
  gameType: {
    type: String,
    enum: [
      'NLH', 'PLO4', 'PLO5', 'OmahaHILO', 'SDH', 'STUD', 
      'RAZZ', 'PINEAPPLE', 'COURCHEVEL', '5CD', 'BADUGI', 'MIXED'
    ],
    default: 'NLH',
    required: true,
  },
  // Reconciled legacy field injected into the schema
  blindsOrAntes: {
    type: String,
    enum: ['blinds', 'antes', 'both'],
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
pokerSchema.pre<IPokerDocument>('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// 4. Model Export
const Poker: Model<IPokerDocument> = mongoose.models.Poker || mongoose.model<IPokerDocument>('Poker', pokerSchema);

export default Poker;