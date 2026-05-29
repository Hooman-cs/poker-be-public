/**
 * @fileoverview WalletTransaction Model
 * Records every individual wallet movement for a user.
 * Separated from the Wallet model for performance and scalability.
 *
 * All amounts are INTEGER minor units (paise/cents), never floats.
 * Registered as the 'WalletTransaction' model (collection: wallettransactions).
 * NOTE: this was previously registered as 'Transaction' — any code that referenced
 * model name 'Transaction' or ref: 'Transaction' must now use 'WalletTransaction'.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, Currency } from '@/config/constants';

export type TransactionType =
  | 'deposit'
  | 'withdraw'
  | 'deskIn'
  | 'deskWithdraw'
  | 'bonus'
  | 'pgDeposit';

export type TransactionStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'reversed';

/**
 * The breakdown of a single transaction's money, all in minor units.
 * total should equal the net the transaction represents; the component fields
 * (cash/bonus/gst/tds/etc.) explain how that total is composed.
 */
export interface IAmountBreakdown {
  cashAmount: number;
  instantBonus: number;
  lockedBonus: number;
  gst: number;
  tds: number;
  otherDeductions: number;
  total: number;
}

export interface ITransaction {
  walletId: mongoose.Types.ObjectId;
  type: TransactionType;
  status: TransactionStatus;
  amount: IAmountBreakdown;
  /** Currency of this transaction; must match the wallet's currency. */
  currency: Currency;
  remark?: string;
  deskId?: mongoose.Types.ObjectId;
  bankTransactionId?: mongoose.Types.ObjectId;
  gatewayTransactionId?: mongoose.Types.ObjectId;
  /** When the transaction settled (distinct from createdAt row-creation time). */
  completedAt?: Date;
}

export interface ITransactionDocument extends ITransaction, Document {}

const AmountBreakdownSchema = new Schema<IAmountBreakdown>(
  {
    cashAmount: { type: Number, default: 0 },
    instantBonus: { type: Number, default: 0 },
    lockedBonus: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const TransactionSchema = new Schema<ITransactionDocument>(
  {
    walletId: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
      required: [true, 'Wallet ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: ['deposit', 'withdraw', 'deskIn', 'deskWithdraw', 'bonus', 'pgDeposit'],
      required: [true, 'Transaction type is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'pending',
      required: true,
    },
    amount: {
      type: AmountBreakdownSchema,
      required: true,
    },
    currency: {
      type: String,
      enum: SUPPORTED_CURRENCIES,
      default: DEFAULT_CURRENCY,
      required: true,
    },
    remark: {
      type: String,
      trim: true,
    },
    deskId: {
      type: Schema.Types.ObjectId,
      ref: 'PokerDesk',
      default: null,
    },
    bankTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'BankTransaction',
      default: null,
    },
    gatewayTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'GatewayTransaction',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Guard: every money field in the breakdown must be a whole number (minor units).
 * Catches a float slipping in without toMinor() loudly at write time.
 */
TransactionSchema.pre('save', function (next) {
  const a = this.amount;
  const fields: Array<keyof IAmountBreakdown> = [
    'cashAmount', 'instantBonus', 'lockedBonus', 'gst', 'tds', 'otherDeductions', 'total',
  ];
  for (const f of fields) {
    const v = a[f];
    if (!Number.isInteger(v)) {
      return next(new Error(`WalletTransaction.amount.${f} must be an integer (minor units); got ${v}`));
    }
  }
  next();
});

TransactionSchema.index({ walletId: 1, createdAt: -1 });
TransactionSchema.index({ walletId: 1, type: 1 });
TransactionSchema.index({ walletId: 1, status: 1 });

const WalletTransaction: Model<ITransactionDocument> =
  mongoose.models.WalletTransaction ||
  mongoose.model<ITransactionDocument>('WalletTransaction', TransactionSchema);

export default WalletTransaction;