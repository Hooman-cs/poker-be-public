// models/PokerGameArchive.js

import mongoose, { Schema } from 'mongoose';
import {
    IPlayer,
    IRound
} from '../utils/pokerModelTypes'; 

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
  
// Define Round schema
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
  
const PotSchema = new Schema({
    amount: { type: Number, required: true, default: 0 }, // Total amount in the pot
    contributors: [
        {
            playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // The ID of the player contributing to the pot
            contribution: { type: Number, required: true, default: 0 }, // The amount contributed by the player
        },
    ],
    winners: [
        {
            playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // The ID of the player contributing to the pot
            amount: { type: Number, required: true, default: 0 }, // The amount contributed by the player
        },
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// Define the Archive Schema
const PokerGameArchiveSchema = new Schema({
    deskId: { type: Schema.Types.ObjectId, ref: 'PokerDesk', required: true },
    deskName : { 
        type: String,
        default : 'LETKNOW',
        required: true,
    },
    stack : { type: Number, default: 0 },
    mode: {
        type: String,
        enum: ['practice', 'cash'],
        default: 'cash',
        required: true,
    },
    bType: {
        type: String,
        enum: ['blinds', 'antes','both'],
        required: true,
    },  
    gameType: {
        type: String,
        enum: [
          'NLH',       // No Limit Hold'em
          'PLO4',      // Pot Limit Omaha (4 cards)
          'PLO5',      // Pot Limit Omaha (5 cards)
          'OmahaHILO', // High-Low split games (e.g., Omaha Hi-Lo)
          'SDH',       // Short Deck Hold'em
          'STUD',      // Seven Card Stud
          'RAZZ',      // Razz (lowball)
          'PINEAPPLE', // Pineapple Poker
          'COURCHEVEL',// Courchevel Poker
          '5CD',       // Five Card Draw
          'BADUGI',    // Badugi Poker
          'MIXED',     // Mixed Games (e.g., H.O.R.S.E)
        ],
        default : 'NLH',
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

// Create the Archive Model
const PokerGameArchive = mongoose.models.PokerGameArchive || mongoose.model('PokerGameArchive', PokerGameArchiveSchema);

export default PokerGameArchive;
