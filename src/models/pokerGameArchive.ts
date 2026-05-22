/**
 * @fileoverview Poker Game Archive Model
 * Records completed poker games for admin analytics and user game history.
 * Hand history is intentionally excluded — too large and not used anywhere.
 * If hand history is needed in future it should be a separate collection.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { PokerGameType } from '@/models/poker';

export interface IGamePlayer {
  userId: mongoose.Types.ObjectId;
  username: string;
  seatNumber: number;
  startingStack: number;
  endingStack: number;
  totalBet: number;
  isWinner: boolean;
}

export interface IPotWinner {
  playerId: mongoose.Types.ObjectId;
  username: string;
  amount: number;
  handDescription: string;
}

export interface IGamePot {
  potNumber: number;
  totalAmount: number;
  winners: IPotWinner[];
}

export interface IPokerGameArchive {
  deskId: mongoose.Types.ObjectId;
  pokerModeId: mongoose.Types.ObjectId;
  gameType: PokerGameType;
  players: IGamePlayer[];
  pots: IGamePot[];
  totalPot: number;
  startedAt: Date;
  completedAt: Date;
}

export interface IPokerGameArchiveDocument extends IPokerGameArchive, Document {}

const GamePlayerSchema = new Schema<IGamePlayer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    seatNumber: {
      type: Number,
      required: true,
    },
    startingStack: {
      type: Number,
      required: true,
      min: 0,
    },
    endingStack: {
      type: Number,
      required: true,
      min: 0,
    },
    totalBet: {
      type: Number,
      required: true,
      min: 0,
    },
    isWinner: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const PotWinnerSchema = new Schema<IPotWinner>(
  {
    playerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    handDescription: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const GamePotSchema = new Schema<IGamePot>(
  {
    potNumber: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    winners: {
      type: [PotWinnerSchema],
      default: [],
    },
  },
  { _id: false }
);

const PokerGameArchiveSchema = new Schema<IPokerGameArchiveDocument>(
  {
    deskId: {
      type: Schema.Types.ObjectId,
      ref: 'PokerDesk',
      required: [true, 'Desk ID is required'],
      index: true,
    },
    pokerModeId: {
      type: Schema.Types.ObjectId,
      ref: 'PokerMode',
      required: [true, 'Poker mode ID is required'],
      index: true,
    },
    gameType: {
      type: String,
      enum: [
        "Texas Hold'em",
        'Omaha',
        'Seven-Card Stud',
        'Razz',
        'Five-Card Draw',
      ],
      required: [true, 'Game type is required'],
    },
    players: {
      type: [GamePlayerSchema],
      default: [],
    },
    pots: {
      type: [GamePotSchema],
      default: [],
    },
    totalPot: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
  }
);

PokerGameArchiveSchema.index({ 'players.userId': 1, completedAt: -1 });
PokerGameArchiveSchema.index({ deskId: 1, completedAt: -1 });
PokerGameArchiveSchema.index({ pokerModeId: 1, completedAt: -1 });
PokerGameArchiveSchema.index({ gameType: 1, completedAt: -1 });

const PokerGameArchive: Model<IPokerGameArchiveDocument> =
  mongoose.models.PokerGameArchive ||
  mongoose.model<IPokerGameArchiveDocument>(
    'PokerGameArchive',
    PokerGameArchiveSchema
  );

export default PokerGameArchive;