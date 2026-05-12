/**
 * @fileoverview Bank Account Database Model
 * Stores user bank details securely for withdrawals.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { IBankAccount } from '@/utils/pokerModelTypes';

// 1. Strict Types for the Mongoose Document
// We Omit '_id' (to prevent collision with Mongoose's ObjectId) and 'userId' 
// (so we can strictly enforce it as a Mongoose ObjectId at the database level).
export interface IBankAccountDocument extends Omit<IBankAccount, '_id' | 'userId'>, Document {
  userId: mongoose.Types.ObjectId;
}

// 2. Schema Definition
const BankAccountSchema: Schema<IBankAccountDocument> = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  accountNumber: { type: String, required: true },
  bankName: { type: String, required: true },
  ifscCode: { type: String, required: true },
  accountHolderName: { type: String, required: true },
  isDefault: { 
    type: Boolean, 
    default: false,
    required: true 
  },
  status: {
    type: String,
    enum: ['active', 'blocked', 'inactive'],
    default: 'active',
    required: true,
  },
});

// 3. Model Export
const BankAccount: Model<IBankAccountDocument> = 
  mongoose.models.BankAccount || mongoose.model<IBankAccountDocument>('BankAccount', BankAccountSchema);

export default BankAccount;