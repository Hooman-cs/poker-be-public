/**
 * @fileoverview Poker Game Archive Database Model
 * The immutable historical ledger of completed poker hands and matches.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  IPlayer,
  IRound,
  IPokerGameArchive,
  IArchivePot
} from '@/utils/pokerModelTypes';

// -----------------------------------------------------------------------------
// Strict Document Interfaces
// -----------------------------------------------------------------------------

export interface IArchivePotDocument extends Omit<IArchivePot, '_id' | 'contributors' | 'winners'>, Document {
  contributors: { playerId: mongoose.Types.ObjectId; contribution: number }[];
  winners: { playerId: mongoose.Types.ObjectId; amount: number }[];
}

export interface IPokerGameArchiveDocument extends Omit<IPokerGameArchive, '_id' | 'deskId' | 'currentTurnPlayer' | 'pots'>, Document {
  deskId: mongoose.Types.ObjectId;
  currentTurnPlayer: mongoose.Types.ObjectId | null;
  pots: IArchivePotDocument[];
}

// -----------------------------------------------------------------------------
// Sub-Schemas
// -----------------------------------------------------------------------------

const PlayerSchema = new Schema<IPlayer>({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  balanceAtTable: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'all-in', 'folded', 'sitting-out'], default: 'active' },
  totalBet: { type: Number, default: 0 },
  holeCards: [{
    suit: { type: String, enum: ['hearts', 'diamonds', 'clubs', 'spades'] },
    rank: { type: String, enum: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] }
  }],
  role: { type: String, enum: ['sb', 'bb', 'player'], default: 'player' }
}, { _id: false });

const RoundSchema = new Schema<IRound>({
  name: { type: String, enum: ['pre-flop', 'flop', 'turn', 'river', 'showdown'] },
  bettingRoundStartedAt: { type: Date, default: Date.now },
  actions: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ['fold', 'check', 'call', 'raise', 'all-in', 'small-blind', 'big-blind'] },
    amount: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
  }]
}, { _id: false });

const PotSchema = new Schema<IArchivePotDocument>({
  amount: { type: Number, required: true, default: 0 },
  contributors: [{
    playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contribution: { type: Number, required: true, default: 0 },
  }],
  winners: [{
    playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, default: 0 },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// -----------------------------------------------------------------------------
// Main Archive Schema
// -----------------------------------------------------------------------------

const PokerGameArchiveSchema = new Schema<IPokerGameArchiveDocument>({
  deskId: { type: Schema.Types.ObjectId, ref: 'PokerDesk', required: true },
  deskName: { type: String, default: 'LETKNOW', required: true },
  stack: { type: Number, default: 0 },
  mode: { type: String, enum: ['practice', 'cash'], default: 'cash', required: true },
  bType: { type: String, enum: ['blinds', 'antes', 'both'], required: true },
  gameType: {
    type: String,
    enum: [
      'NLH', 'PLO4', 'PLO5', 'OmahaHILO', 'SDH', 'STUD',
      'RAZZ', 'PINEAPPLE', 'COURCHEVEL', '5CD', 'BADUGI', 'MIXED'
    ],
    default: 'NLH',
    required: true,
  },
  players: [PlayerSchema],
  currentTurnPlayer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  totalBet: { type: Number, default: 0 },
  status: { type: String, enum: ['waiting', 'in-progress', 'finished'], default: 'finished' },
  rounds: [RoundSchema],
  communityCards: [{
    suit: { type: String, enum: ['hearts', 'diamonds', 'clubs', 'spades'] },
    rank: { type: String, enum: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] }
  }],
  pots: { type: [PotSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// -----------------------------------------------------------------------------
// Model Export
// -----------------------------------------------------------------------------

const PokerGameArchive: Model<IPokerGameArchiveDocument> = 
  mongoose.models.PokerGameArchive || mongoose.model<IPokerGameArchiveDocument>('PokerGameArchive', PokerGameArchiveSchema);

export default PokerGameArchive;