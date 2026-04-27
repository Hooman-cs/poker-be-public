// bankTransaction.ts (Bank Transaction Model)
import mongoose, { Schema, Document } from 'mongoose';
import BankAccount from './bankAccount'; // Import BankAccount model
import User from './user'

export interface IBankTransaction extends Document {
  userId: mongoose.Types.ObjectId; // Reference to User
  bankId: mongoose.Types.ObjectId; // Reference to BankAccount
  createdOn: Date;
  completedOn?: Date;
  status: 'failed' | 'completed' | 'pending';
  amount: number;
  type: 'deposit' | 'withdraw';
  remark?: string;
  imageUrl: string; // New imageUrl field
}

const BankTransactionSchema: Schema<IBankTransaction> = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount', // Reference to BankAccount model
    required: true,
  },
  createdOn: { type: Date, default: Date.now },
  completedOn: { type: Date },
  status: {
    type: String,
    enum: ['failed', 'completed', 'pending'],
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
    required: true, // Making imageUrl required
  },
});

const BankTransaction = mongoose.models.BankTransaction || mongoose.model<IBankTransaction>('BankTransaction', BankTransactionSchema);

export default BankTransaction;
