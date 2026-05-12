/**
 * @fileoverview Bank Transaction Database Model
 * Records deposit and withdrawal requests linked to a specific Bank Account.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { IBankTransaction } from '@/utils/pokerModelTypes';

// 1. Strict Types for the Mongoose Document
// Omit frontend IDs and enforce strict ObjectIds for relationships
export interface IBankTransactionDocument extends Omit<IBankTransaction, '_id' | 'userId' | 'bankId'>, Document {
  userId: mongoose.Types.ObjectId;
  bankId: mongoose.Types.ObjectId;
}

// 2. Schema Definition
const BankTransactionSchema: Schema<IBankTransactionDocument> = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    required: true,
  },
  createdOn: { type: Date, default: Date.now },
  completedOn: { type: Date },
  status: {
    type: String,
    enum: ['failed', 'completed', 'pending', 'successful', 'waiting'],
    required: true,
  },
  amount: { type: Number, required: true },
  type: {
    type: String,
    enum: ['deposit', 'withdraw'],
    required: true,
  },
  remark: { type: String },
  imageUrl: { 
    type: String, 
    required: true,
  },
});

// 3. Model Export
const BankTransaction: Model<IBankTransactionDocument> = 
  mongoose.models.BankTransaction || mongoose.model<IBankTransactionDocument>('BankTransaction', BankTransactionSchema);

export default BankTransaction;