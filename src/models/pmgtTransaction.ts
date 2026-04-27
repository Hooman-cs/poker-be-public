import mongoose, { Document, Schema, Model, model } from 'mongoose';

// Define the interface for the PMGTransaction schema
export interface IPMGTransaction extends Document {
  userId: mongoose.Types.ObjectId; // Reference to the User model
  orderId?: string; // Razorpay Order ID
  status: 'created' | 'successful' | 'failed' | 'pending'; // Enum for transaction status
  amount: number; // Transaction amount
  currency: string; // Transaction currency, default is INR
  notes: Record<string, any>; // Additional notes
  razPayId?: string;
  razSignature?:string;
  createdAt: Date; // Timestamp when the transaction was created
  updatedAt: Date; // Timestamp when the transaction was updated
}

// Define the schema for PMGTransaction
const PMGTransactionSchema = new Schema<IPMGTransaction>(
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
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

// Export the Mongoose model
export const PMGTransaction: Model<IPMGTransaction> =
  mongoose.models.PmgTransaction || model<IPMGTransaction>('PmgTransaction', PMGTransactionSchema);

export default PMGTransaction;
