
import { IUser, IWallet, IWalletTransaction, IAmountBreakdown } from '@/utils/pokerModelTypes';
import mongoose, { Schema, Model, Document } from 'mongoose';

const AmountBreakdownSchema : Schema<IAmountBreakdown> = new Schema({
  cashAmount: { type: Number, default: 0 }, // Cash portion of the transaction
  instantBonus: { type: Number, default: 0 }, // Instant bonus portion
  lockedBonus: { type: Number, default: 0 }, // Locked bonus portion
  gst: { type: Number, default: 0 }, // GST portion
  tds: { type: Number, default: 0 }, // TDS deductions
  otherDeductions: { type: Number, default: 0 }, // Additional deductions, if any
  total: { type: Number, required: true }, // Total transaction amount
});


const WalletTransactionSchema: Schema<IWalletTransaction> = new Schema({
  createdOn: { type: Date, default: Date.now },
  completedOn: { type: Date },
  status: { type: String, enum: ['failed', 'completed', 'pending'], required: true },
  amount: { type: AmountBreakdownSchema, required: true }, // Nested breakdown for amounts
  type: {
    type: String,
    enum: ['deposit', 'withdraw', 'deskIn', 'deskWithdraw', 'bonus', 'pgDeposit'],
    required: true,
  },
  remark: { type: String },
  DeskId: { type: mongoose.Schema.Types.ObjectId, ref: 'PokerDesk' },
  BankTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankTransaction' },
  pmgtId : { type: mongoose.Schema.Types.ObjectId, ref: 'PmgTransaction' },
});

const WalletSchema: Schema<IWallet> = new Schema({
  balance: { type: Number, default: 0, min: 0 },
  instantBonus: { type: Number, default: 0, min: 0 },
  lockedBonus: { type: Number, default: 0 },
  transactions: [WalletTransactionSchema],
});

const UserSchema: Schema<IUser> = new Schema({
  mobileNumber: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: (v: string) => /^[0-9]{10}$/.test(v),
      message: (props: { value: string }) => `${props.value} is not a valid mobile number!`,
    },
  },
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 30,
  },  
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

UserSchema.methods.updateLastLogin = async function (req: any): Promise<void> {
  this.lastLogin = new Date();

  // Access headers directly
  this.deviceInfo = req.headers['user-agent'] || 'Unknown device'; // Access 'user-agent' directly
  this.ipAddress = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'Unknown IP'; // Access 'x-forwarded-for' directly

  // Assert req.body type to avoid ReadableStream errors
  const body = req.body as { latitude?: number; longitude?: number; deviceType?: string };

  this.deviceType = body.deviceType || 'android'; // Default to 'android' if not provided
  this.latitude = body.latitude ?? null; // Use null if latitude is missing
  this.longitude = body.longitude ?? null; // Use null if longitude is missing
  await this.save();
};

UserSchema.methods.toggleActiveStatus = async function (): Promise<void> {
  this.isActive = !this.isActive;
  await this.save();
};


const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;

