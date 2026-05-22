/**
 * @fileoverview Gateway Transaction Model
 * Records payment gateway transactions for wallet deposits.
 * Currently supports Razorpay, designed to support multiple gateways in future.
 * Withdrawals are handled via manual bank transactions, not payment gateway.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export type GatewayName = 'razorpay' | 'stripe';
export type GatewayTransactionStatus = 'created' | 'pending' | 'successful' | 'failed';

export interface IGatewayTransaction {
  userId: mongoose.Types.ObjectId;
  gateway: GatewayName;
  amount: number;
  currency: string;
  status: GatewayTransactionStatus;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGatewayTransactionDocument extends IGatewayTransaction, Document {}

const GatewayTransactionSchema = new Schema<IGatewayTransactionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    gateway: {
      type: String,
      enum: ['razorpay', 'stripe'],
      required: [true, 'Payment gateway name is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be at least 1'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      uppercase: true,
      trim: true,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['created', 'pending', 'successful', 'failed'],
      default: 'created',
      required: true,
    },
    gatewayOrderId: {
      type: String,
      default: null,
    },
    gatewayPaymentId: {
      type: String,
      default: null,
    },
    gatewaySignature: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

GatewayTransactionSchema.index({ userId: 1, createdAt: -1 });
GatewayTransactionSchema.index({ gatewayOrderId: 1 });
GatewayTransactionSchema.index({ userId: 1, status: 1 });

const GatewayTransaction: Model<IGatewayTransactionDocument> =
  mongoose.models.GatewayTransaction ||
  mongoose.model<IGatewayTransactionDocument>(
    'GatewayTransaction',
    GatewayTransactionSchema
  );

export default GatewayTransaction;