/**
 * @fileoverview Wallet Model
 * Stores balance information for each user.
 * One wallet per user.
 * Transaction history lives in the Transaction model.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWallet {
  userId: mongoose.Types.ObjectId;
  balance: number;
  instantBonus: number;
  lockedBonus: number;
}

export interface IWalletDocument extends IWallet, Document {}

const WalletSchema = new Schema<IWalletDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    instantBonus: {
      type: Number,
      default: 0,
      min: [0, 'Instant bonus cannot be negative'],
    },
    lockedBonus: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Wallet: Model<IWalletDocument> =
  mongoose.models.Wallet ||
  mongoose.model<IWalletDocument>('Wallet', WalletSchema);

export default Wallet;