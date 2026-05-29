/**
 * @fileoverview Wallet Model
 * One wallet per user (Shape 1 — a user holds a single currency).
 * All balances are stored as INTEGER minor units (paise/cents), never floats.
 * Transaction history lives in the WalletTransaction model.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, Currency } from '@/config/constants';

export interface IWallet {
  userId: mongoose.Types.ObjectId;
  /** Spendable balance, in minor units. */
  balance: number;
  /** Instant (usable) bonus, in minor units. */
  instantBonus: number;
  /** Locked bonus not yet released to balance, in minor units. */
  lockedBonus: number;
  /** Currency this wallet is denominated in. A wallet never mixes currencies. */
  currency: Currency;
}

export interface IWalletDocument extends IWallet, Document {}

const WalletSchema = new Schema<IWalletDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true, // one wallet per user (Shape 1)
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
      // minor units; validated as an integer below
    },
    instantBonus: {
      type: Number,
      default: 0,
      min: [0, 'Instant bonus cannot be negative'],
    },
    lockedBonus: {
      type: Number,
      default: 0,
      min: [0, 'Locked bonus cannot be negative'],
    },
    currency: {
      type: String,
      enum: SUPPORTED_CURRENCIES,
      default: DEFAULT_CURRENCY,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Guard against floats sneaking into stored money. All three balances must be
 * whole numbers because they are minor units. This catches conversion mistakes
 * (e.g. a major value assigned without toMinor) loudly instead of silently.
 */
WalletSchema.pre('save', function (next) {
  const fields: Array<keyof IWallet> = ['balance', 'instantBonus', 'lockedBonus'];
  for (const f of fields) {
    const v = this[f] as number;
    if (!Number.isInteger(v)) {
      return next(new Error(`Wallet.${f} must be an integer (minor units); got ${v}`));
    }
  }
  next();
});

const Wallet: Model<IWalletDocument> =
  mongoose.models.Wallet ||
  mongoose.model<IWalletDocument>('Wallet', WalletSchema);

export default Wallet;