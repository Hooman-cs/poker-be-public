import mongoose, { Schema, Types, Document } from 'mongoose';

export interface IPracticeSession {
  userId: Types.ObjectId;
  deskId: Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  /** Final stack when the player left, minor units. Null until the session ends. */
  finalChips?: number;
}

export interface IPracticeSessionDocument extends IPracticeSession, Document {}

const PracticeSessionSchema = new Schema<IPracticeSessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deskId: {
      type: Schema.Types.ObjectId,
      ref: 'PokerDesk',
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
    finalChips: {
      type: Number,
    },
  },
  { timestamps: false }
);

PracticeSessionSchema.index({ userId: 1, startedAt: -1 });

const PracticeSession =
  mongoose.models.PracticeSession ||
  mongoose.model<IPracticeSessionDocument>('PracticeSession', PracticeSessionSchema);

export default PracticeSession;
