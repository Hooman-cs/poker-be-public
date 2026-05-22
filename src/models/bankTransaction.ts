/**
 * @fileoverview Bank Transaction Model
 * Records manual deposit and withdrawal requests linked to a user bank account.
 * Deposits require a receipt image URL for admin verification.
 * Withdrawals do not require an image.
 * Status is updated by admin after verification.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export type BankTransactionType = 'deposit' | 'withdraw';
export type BankTransactionStatus = 'pending' | 'completed' | 'failed';

export interface IBankTransaction {
  userId: mongoose.Types.ObjectId;
  bankAccountId: mongoose.Types.ObjectId;
  type: BankTransactionType;
  amount: number;
  status: BankTransactionStatus;
  imageUrl?: string;
  remark?: string;
  createdOn: Date;
  completedOn?: Date;
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
      min: [1, 'Amount must be at least 1'],
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

BankTransactionSchema.index({ userId: 1, createdOn: -1 });
BankTransactionSchema.index({ userId: 1, status: 1 });
BankTransactionSchema.index({ userId: 1, type: 1 });

const BankTransaction: Model<IBankTransactionDocument> =
  mongoose.models.BankTransaction ||
  mongoose.model<IBankTransactionDocument>(
    'BankTransaction',
    BankTransactionSchema
  );

export default BankTransaction;
// /**
//  * @fileoverview Bank Transaction Database Model
//  * Records deposit and withdrawal requests linked to a specific Bank Account.
//  */

// import mongoose, { Schema, Document, Model } from 'mongoose';
// import { IBankTransaction } from '@/utils/pokerModelTypes';

// // 1. Strict Types for the Mongoose Document
// // Omit frontend IDs and enforce strict ObjectIds for relationships
// export interface IBankTransactionDocument extends Omit<IBankTransaction, '_id' | 'userId' | 'bankId'>, Document {
//   userId: mongoose.Types.ObjectId;
//   bankId: mongoose.Types.ObjectId;
// }

// // 2. Schema Definition
// const BankTransactionSchema: Schema<IBankTransactionDocument> = new Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//   },
//   bankId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'BankAccount',
//     required: true,
//   },
//   createdOn: { type: Date, default: Date.now },
//   completedOn: { type: Date },
//   status: {
//     type: String,
//     enum: ['failed', 'completed', 'pending', 'successful', 'waiting'],
//     required: true,
//   },
//   amount: { type: Number, required: true },
//   type: {
//     type: String,
//     enum: ['deposit', 'withdraw'],
//     required: true,
//   },
//   remark: { type: String },
//   imageUrl: { 
//     type: String, 
//     required: true,
//   },
// });

// // 3. Model Export
// const BankTransaction: Model<IBankTransactionDocument> = 
//   mongoose.models.BankTransaction || mongoose.model<IBankTransactionDocument>('BankTransaction', BankTransactionSchema);

// export default BankTransaction;