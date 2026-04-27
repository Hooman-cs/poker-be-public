// models/PokerMode.ts
import mongoose, { Document, Schema } from 'mongoose';

// Define the interface for PokerMode
interface IPokerMode extends Document {
  pokerId: mongoose.Schema.Types.ObjectId;
  stake?: number; // Single field for either smallBlind, bigBlind, or anteAmount
  minBuyIn: number;
  maxBuyIn: number; 
  bType: 'blinds' | 'antes' | 'both' ; // To differentiate
  status: 'active' | 'disable'; // Field for status 
  createdAt: Date;
  mode:  'practice' | 'cash';
  updatedAt: Date;
}

// Define the schema for PokerMode
const pokerModeSchema = new Schema<IPokerMode>({
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
  bType : {
    type: String,
    enum: ['blinds', 'antes'],
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

// Update the updatedAt field before saving
pokerModeSchema.pre<IPokerMode>('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const PokerMode = mongoose.models.Pokermode || mongoose.model<IPokerMode>('Pokermode', pokerModeSchema);

export default PokerMode;
