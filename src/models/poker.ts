// models/Poker.ts
import mongoose, { Document, Schema } from 'mongoose';

interface IPoker extends Document {
  name: string; 
  objective: string;
  rules: Map<string, string>;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'maintenance' | 'disable';
  gameType: 'NLH' | 'PLO4' | 'PLO5' | 'OmahaHILO' | 'SDH' | 'STUD' | 'RAZZ' | 'PINEAPPLE' | 'COURCHEVEL' | '5CD' | 'BADUGI' | 'MIXED';
  
}

const pokerSchema: Schema = new Schema({
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String, // 'active', 'maintenance', or 'notactive'
    enum: ['active', 'maintenance', 'disable'],
    default: 'active', // Default to 'active'
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
});

// Middleware to update the 'updatedAt' field
pokerSchema.pre<IPoker>('save', function (next) {
  this.updatedAt = new Date(); // Convert to Date object
  next();
});

const Poker = mongoose.models.Poker || mongoose.model<IPoker>('Poker', pokerSchema);

export default Poker;
