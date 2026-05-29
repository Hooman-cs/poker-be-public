/**
 * @fileoverview Bank Transaction Model
 * Records manual deposit and withdrawal requests linked to a user bank account.
 * Deposits require a receipt image URL for admin verification; withdrawals do not.
 * Status is updated by an admin after verification.
 *
 * amount is stored in INTEGER minor units (paise/cents), never a float.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, Currency } from '@/config/constants';

export type BankTransactionType = 'deposit' | 'withdraw';
export type BankTransactionStatus = 'pending' | 'completed' | 'failed';

export interface IBankTransaction {
  userId: mongoose.Types.ObjectId;
  bankAccountId: mongoose.Types.ObjectId;
  type: BankTransactionType;
  /** Amount in minor units. */
  amount: number;
  currency: Currency;
  status: BankTransactionStatus;
  imageUrl?: string;
  remark?: string;
  /** When the request was settled by an admin (distinct from createdAt). */
  completedAt?: Date;
}

export interface IBankTransactionDocument extends IBankTransaction, Document {}

const BankTransactionSchema = new Schema<IBankTransactionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    bankAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'BankAccount',
      required: [true, 'Bank account ID is required'],
    },
    type: {
      type: String,
      enum: ['deposit', 'withdraw'],
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be at least 1 minor unit'],
    },
    currency: {
      type: String,
      enum: SUPPORTED_CURRENCIES,
      default: DEFAULT_CURRENCY,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    imageUrl: {
      type: String,
      default: null,
    },
    remark: {
      type: String,
      trim: true,
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

/** Guard: amount must be a whole number of minor units. */
BankTransactionSchema.pre('save', function (next) {
  if (!Number.isInteger(this.amount)) {
    return next(new Error(`BankTransaction.amount must be an integer (minor units); got ${this.amount}`));
  }
  next();
});

BankTransactionSchema.index({ userId: 1, createdAt: -1 });
BankTransactionSchema.index({ userId: 1, status: 1 });
BankTransactionSchema.index({ userId: 1, type: 1 });

const BankTransaction: Model<IBankTransactionDocument> =
  mongoose.models.BankTransaction ||
  mongoose.model<IBankTransactionDocument>('BankTransaction', BankTransactionSchema);

export default BankTransaction;