/**
 * @fileoverview Payment Gateway (PMG) Transaction Database Model
 * Records Razorpay (or other provider) transactions for wallet top-ups.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { IPmgTransaction } from '@/utils/pokerModelTypes';

// 1. Strict Types for the Mongoose Document
export interface IPmgTransactionDocument extends Omit<IPmgTransaction, '_id' | 'userId'>, Document {
  userId: mongoose.Types.ObjectId;
}

// 2. Schema Definition
const PmgTransactionSchema: Schema<IPmgTransactionDocument> = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: String, default: null },
    razPayId: { type: String, default: null },
    razSignature: { type: String, default: null },
    status: {
      type: String,
      enum: ['created', 'successful', 'failed', 'pending'],
      required: true,
      default: 'created',
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    notes: { type: Object, default: {} },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// 3. Model Export
const PmgTransaction: Model<IPmgTransactionDocument> =
  mongoose.models.PmgTransaction || mongoose.model<IPmgTransactionDocument>('PmgTransaction', PmgTransactionSchema);

export default PmgTransaction;