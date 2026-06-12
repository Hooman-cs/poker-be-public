import mongoose, { Schema, Types, Document } from 'mongoose';
import { BOT_DIFFICULTIES } from '@/config/constants';
import type { BotDifficulty } from '@/config/constants';

export interface IBot {
  deskId: Types.ObjectId;
  botId: Types.ObjectId;
  seatNumber: number;
  strategy: BotDifficulty;
  botName: string;
}

export interface IBotDocument extends IBot, Document {}

const BotSchema = new Schema<IBotDocument>(
  {
    deskId: {
      type: Schema.Types.ObjectId,
      ref: 'PokerDesk',
      required: true,
      index: true,
    },
    botId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    seatNumber: {
      type: Number,
      required: true,
    },
    strategy: {
      type: String,
      enum: BOT_DIFFICULTIES,
      required: true,
    },
    botName: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Bot =
  mongoose.models.Bot || mongoose.model<IBotDocument>('Bot', BotSchema);

export default Bot;
