/**
 * @fileoverview User Model
 * Handles user identity and authentication.
 * Wallet and transactions live in their own models.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserStatus = 'active' | 'inactive' | 'suspended';
export type DeviceType = 'android' | 'ios' | 'unknown';

export interface IUser {
  mobileNumber: string;
  username: string;
  status: UserStatus;
  deviceType: DeviceType;
  registrationDate: Date;
  lastLogin: Date | null;
}

export interface IUserDocument extends IUser, Document {}

const UserSchema = new Schema<IUserDocument>(
  {
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      validate: {
        validator: (v: string) => /^[0-9]{10}$/.test(v),
        message: (props: { value: string }) =>
          `${props.value} is not a valid 10-digit mobile number`,
      },
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    deviceType: {
      type: String,
      enum: ['android', 'ios', 'unknown'],
      default: 'unknown',
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ mobileNumber: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ status: 1 });

const User: Model<IUserDocument> =
  mongoose.models.User ||
  mongoose.model<IUserDocument>('User', UserSchema);

export default User;