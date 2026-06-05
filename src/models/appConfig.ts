/**
 * @fileoverview AppConfig Model — singleton runtime configuration.
 * One document in the collection. Read by routes, written by admin (Phase 4 task 4.15).
 * If no document exists, callers fall back to defaults (1.28 / 1.0).
 *
 * Pattern: AppConfig.findOne({}) returns the config or null → use defaults.
 * Admin update: AppConfig.findOneAndUpdate({}, { ... }, { upsert: true, new: true }).
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAppConfig {
  /** GST multiplier for deposit splits. gross / gstMultiplier = cash credited.
   *  Default 1.28 (28% GST on base value — Indian online gaming rate).
   *  Must be >= 1. */
  gstMultiplier: number;
  /** Fraction of the GST amount credited back to the user as instantBonus.
   *  Default 1.0 (full GST amount returned as bonus). Range 0–1. */
  depositBonusRate: number;
}

export interface IAppConfigDocument extends IAppConfig, Document {}

const AppConfigSchema = new Schema<IAppConfigDocument>(
  {
    gstMultiplier: {
      type: Number,
      default: 1.28,
    },
    depositBonusRate: {
      type: Number,
      default: 1.0,
    },
  },
  {
    timestamps: true,
  }
);

AppConfigSchema.pre('save', function (next) {
  if (this.gstMultiplier < 1) {
    return next(new Error('AppConfig.gstMultiplier must be >= 1'));
  }
  if (this.depositBonusRate < 0 || this.depositBonusRate > 1) {
    return next(new Error('AppConfig.depositBonusRate must be between 0 and 1'));
  }
  next();
});

const AppConfig: Model<IAppConfigDocument> =
  mongoose.models.AppConfig ||
  mongoose.model<IAppConfigDocument>('AppConfig', AppConfigSchema);

export default AppConfig;
