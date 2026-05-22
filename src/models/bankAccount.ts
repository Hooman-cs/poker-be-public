/**
 * @fileoverview Bank Account Model
 * Stores user saved bank accounts for manual deposits and withdrawals.
 * Maximum 5 bank accounts per user.
 * IFSC validation to be added after testing is complete.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export type BankAccountStatus = 'active' | 'blocked' | 'inactive';

export interface IBankAccount {
  userId: mongoose.Types.ObjectId;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  accountHolderName: string;
  isDefault: boolean;
  status: BankAccountStatus;
}

export interface IBankAccountDocument extends IBankAccount, Document {}

const BankAccountSchema = new Schema<IBankAccountDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true,
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
    },
    ifscCode: {
      type: String,
      required: [true, 'IFSC code is required'],
      trim: true,
      uppercase: true,
    },
    accountHolderName: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'blocked', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

BankAccountSchema.index({ userId: 1, isDefault: 1 });
BankAccountSchema.index({ userId: 1, status: 1 });

// Enforce maximum 5 bank accounts per user
BankAccountSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('BankAccount').countDocuments({
      userId: this.userId,
    });
    if (count >= 5) {
      return next(
        new Error('Maximum of 5 bank accounts allowed per user')
      );
    }
  }
  next();
});

const BankAccount: Model<IBankAccountDocument> =
  mongoose.models.BankAccount ||
  mongoose.model<IBankAccountDocument>('BankAccount', BankAccountSchema);

export default BankAccount;
// /**
//  * @fileoverview Bank Account Database Model
//  * Stores user bank details securely for withdrawals.
//  */

// import mongoose, { Schema, Document, Model } from 'mongoose';
// import { IBankAccount } from '@/utils/pokerModelTypes';

// // 1. Strict Types for the Mongoose Document
// // We Omit '_id' (to prevent collision with Mongoose's ObjectId) and 'userId' 
// // (so we can strictly enforce it as a Mongoose ObjectId at the database level).
// export interface IBankAccountDocument extends Omit<IBankAccount, '_id' | 'userId'>, Document {
//   userId: mongoose.Types.ObjectId;
// }

// // 2. Schema Definition
// const BankAccountSchema: Schema<IBankAccountDocument> = new Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//   },
//   accountNumber: { type: String, required: true },
//   bankName: { type: String, required: true },
//   ifscCode: { type: String, required: true },
//   accountHolderName: { type: String, required: true },
//   isDefault: { 
//     type: Boolean, 
//     default: false,
//     required: true 
//   },
//   status: {
//     type: String,
//     enum: ['active', 'blocked', 'inactive'],
//     default: 'active',
//     required: true,
//   },
// });

// // 3. Model Export
// const BankAccount: Model<IBankAccountDocument> = 
//   mongoose.models.BankAccount || mongoose.model<IBankAccountDocument>('BankAccount', BankAccountSchema);

// export default BankAccount;