/**
 * @fileoverview User Database Model
 * Encapsulates the user schema, wallet tracking, and user-state methods.
 */

import mongoose, { Schema, Model, Document } from 'mongoose';
import { IUser, IWallet, IWalletTransaction, IAmountBreakdown, ILoginMetaData } from '@/utils/pokerModelTypes';

// Strict Types for the Mongoose Document
export interface IUserDocument extends IUser, Document {
  updateLastLogin(metaData: ILoginMetaData): Promise<void>;
  toggleActiveStatus(): Promise<void>;
}

// -----------------------------------------------------------------------------
// Sub-Schemas
// -----------------------------------------------------------------------------

const AmountBreakdownSchema: Schema<IAmountBreakdown> = new Schema({
  cashAmount: { type: Number, default: 0 },
  instantBonus: { type: Number, default: 0 },
  lockedBonus: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  tds: { type: Number, default: 0 },
  otherDeductions: { type: Number, default: 0 },
  total: { type: Number, required: true },
});

const WalletTransactionSchema: Schema<IWalletTransaction> = new Schema({
  createdOn: { type: Date, default: Date.now },
  completedOn: { type: Date },
  status: { type: String, enum: ['failed', 'completed', 'pending'], required: true },
  amount: { type: AmountBreakdownSchema, required: true },
  type: {
    type: String,
    enum: ['deposit', 'withdraw', 'deskIn', 'deskWithdraw', 'bonus', 'pgDeposit'],
    required: true,
  },
  remark: { type: String },
  DeskId: { type: mongoose.Schema.Types.ObjectId, ref: 'PokerDesk' },
  BankTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankTransaction' },
  pmgtId: { type: mongoose.Schema.Types.ObjectId, ref: 'PmgTransaction' },
});

const WalletSchema: Schema<IWallet> = new Schema({
  balance: { type: Number, default: 0, min: 0 },
  instantBonus: { type: Number, default: 0, min: 0 },
  lockedBonus: { type: Number, default: 0 },
  transactions: [WalletTransactionSchema],
});

// -----------------------------------------------------------------------------
// Main User Schema
// -----------------------------------------------------------------------------

const UserSchema: Schema<IUserDocument> = new Schema({
  mobileNumber: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: (v: string) => /^[0-9]{10}$/.test(v),
      message: (props: { value: string }) => `${props.value} is not a valid mobile number!`,
    },
  },
  username: { type: String, required: true, unique: true, minlength: 3, maxlength: 30 },
  registrationDate: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  wallet: { type: WalletSchema, default: () => ({}) },
  deviceInfo: { type: String },
  ipAddress: { type: String },
  deviceType: { type: String, default: 'android' },
  latitude: { type: Number },
  longitude: { type: Number },
});

// -----------------------------------------------------------------------------
// Instance Methods
// -----------------------------------------------------------------------------

UserSchema.methods.updateLastLogin = async function (metaData: ILoginMetaData): Promise<void> {
  this.lastLogin = new Date();
  this.deviceInfo = metaData.deviceInfo;
  this.ipAddress = metaData.ipAddress;
  this.deviceType = metaData.deviceType || 'android';
  this.latitude = metaData.latitude ?? null;
  this.longitude = metaData.longitude ?? null;
  
  await this.save();
};

UserSchema.methods.toggleActiveStatus = async function (): Promise<void> {
  this.isActive = !this.isActive;
  await this.save();
};

// -----------------------------------------------------------------------------
// Model Export
// -----------------------------------------------------------------------------

const User: Model<IUserDocument> = mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

export default User;