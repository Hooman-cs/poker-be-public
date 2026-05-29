/**
 * @fileoverview Gateway Transaction Model
 * Records payment-gateway transactions for wallet deposits.
 * Currently supports Razorpay; designed to allow more gateways later.
 * Withdrawals are handled via manual bank transactions, not the payment gateway.
 *
 * amount is stored in INTEGER minor units (paise/cents), never a float.
 * Success state is 'completed' (standardized across all transaction models —
 * the old 'successful' value has been removed).
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, Currency } from '@/config/constants';

export type GatewayName = 'razorpay' | 'stripe';
export type GatewayTransactionStatus = 'created' | 'pending' | 'completed' | 'failed';

export interface IGatewayTransaction {
  userId: mongoose.Types.ObjectId;
  gateway: GatewayName;
  /** Amount in minor units. */
  amount: number;
  currency: Currency;
  status: GatewayTransactionStatus;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
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
      enum: ['created', 'pending', 'completed', 'failed'],
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

/** Guard: amount must be a whole number of minor units. */
GatewayTransactionSchema.pre('save', function (next) {
  if (!Number.isInteger(this.amount)) {
    return next(new Error(`GatewayTransaction.amount must be an integer (minor units); got ${this.amount}`));
  }
  next();
});

GatewayTransactionSchema.index({ userId: 1, createdAt: -1 });
GatewayTransactionSchema.index({ gatewayOrderId: 1 });
GatewayTransactionSchema.index({ userId: 1, status: 1 });

const GatewayTransaction: Model<IGatewayTransactionDocument> =
  mongoose.models.GatewayTransaction ||
  mongoose.model<IGatewayTransactionDocument>('GatewayTransaction', GatewayTransactionSchema);

export default GatewayTransaction;