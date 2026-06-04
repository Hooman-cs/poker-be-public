/**
 * @fileoverview Poker Model
 * Defines the supported poker game types available on the platform.
 * Each game type can have multiple modes (PokerMode) with different stakes.
 * This is a small reference/config model — no money fields, no currency.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Supported poker game types.
 *
 * NOTE (2026-06-01 LOGS.md): scope narrowed from five game types to two
 * (Hold'em + Omaha) for this rebuild. Stud / Razz / Five-Card Draw were
 * declared in the original union but never had correct first-actor logic
 * in the engine (they require card-based bring-in, not position-based
 * blinds rotation). Rather than ship a playable-but-incorrect game,
 * they're removed from both the type union and the runtime enum.
 *
 * They come back in a future major version of the application (NOT a
 * later phase of this rebuild). When re-introduced, the design needs
 * per-game first-actor rules in the engine BEFORE adding the type back.
 * See LOGS.md 2026-06-01 for the full reasoning and the Five-Card-Draw
 * blinds-vs-antes ambiguity that needs deciding then.
 *
 * The `bType` field on PokerMode/PokerDesk and the `'antes'` branch in
 * gameEngine.initializeGameState are deliberately preserved as forward-
 * compatible dead code so the future re-introduction doesn't require
 * schema-level migration.
 */
export type PokerGameType =
  | "Texas Hold'em"
  | 'Omaha';

export type PokerStatus = 'active' | 'maintenance' | 'disabled';

export interface IPoker {
  gameType: PokerGameType;
  description?: string;
  objective?: string;
  status: PokerStatus;
}

export interface IPokerDocument extends IPoker, Document {}

const PokerSchema = new Schema<IPokerDocument>(
  {
    gameType: {
      type: String,
      enum: [
        "Texas Hold'em",
        'Omaha',
      ],
      required: [true, 'Game type is required'],
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    objective: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'maintenance', 'disabled'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

PokerSchema.index({ status: 1 });

const Poker: Model<IPokerDocument> =
  mongoose.models.Poker ||
  mongoose.model<IPokerDocument>('Poker', PokerSchema);

export default Poker;
// /**
//  * @fileoverview Poker Model
//  * Defines the supported poker game types available on the platform.
//  * Each game type can have multiple modes (PokerMode) with different stakes.
//  * This is a small reference/config model — no money fields, no currency.
//  */

// import mongoose, { Schema, Document, Model } from 'mongoose';

// export type PokerGameType =
//   | "Texas Hold'em"
//   | 'Omaha'
//   | 'Seven-Card Stud'
//   | 'Razz'
//   | 'Five-Card Draw';

// export type PokerStatus = 'active' | 'maintenance' | 'disabled';

// export interface IPoker {
//   gameType: PokerGameType;
//   description?: string;
//   objective?: string;
//   status: PokerStatus;
// }

// export interface IPokerDocument extends IPoker, Document {}

// const PokerSchema = new Schema<IPokerDocument>(
//   {
//     gameType: {
//       type: String,
//       enum: [
//         "Texas Hold'em",
//         'Omaha',
//         'Seven-Card Stud',
//         'Razz',
//         'Five-Card Draw',
//       ],
//       required: [true, 'Game type is required'],
//       unique: true,
//     },
//     description: {
//       type: String,
//       trim: true,
//       default: null,
//     },
//     objective: {
//       type: String,
//       trim: true,
//       default: null,
//     },
//     status: {
//       type: String,
//       enum: ['active', 'maintenance', 'disabled'],
//       default: 'active',
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// PokerSchema.index({ status: 1 });

// const Poker: Model<IPokerDocument> =
//   mongoose.models.Poker ||
//   mongoose.model<IPokerDocument>('Poker', PokerSchema);

// export default Poker;