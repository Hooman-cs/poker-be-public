/**
 * @fileoverview Transaction Model
 * Records every individual wallet transaction for a user.
 * Separated from User model for performance and scalability.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

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
  remark?: string;
  deskId?: mongoose.Types.ObjectId;
  bankTransactionId?: mongoose.Types.ObjectId;
  gatewayTransactionId?: mongoose.Types.ObjectId;
  createdOn: Date;
  completedOn?: Date;
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
    createdOn: {
      type: Date,
      default: Date.now,
    },
    completedOn: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false,
  }
);

TransactionSchema.index({ walletId: 1, createdOn: -1 });
TransactionSchema.index({ walletId: 1, type: 1 });
TransactionSchema.index({ walletId: 1, status: 1 });

const Transaction: Model<ITransactionDocument> =
  mongoose.models.Transaction ||
  mongoose.model<ITransactionDocument>('Transaction', TransactionSchema);

export default Transaction;