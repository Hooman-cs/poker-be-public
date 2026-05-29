/**
 * @fileoverview User Model
 * Handles user identity. Authentication is provider-based (currently Google only;
 * the structure is designed so future providers — Apple, Facebook, mobile-OTP — can
 * be added by inserting an authProviders entry, with no schema migration).
 *
 * Identity rules:
 *   - googleId is found inside authProviders (provider='google', providerId=googleId).
 *   - email is globally unique (one account per email).
 *   - mobileNumber is OPTIONAL contact info only — not used for auth, not unique.
 *   - username is auto-generated unique on first login; user may change it once during
 *     onboarding, after which usernameLocked=true and it becomes permanent.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserStatus = 'active' | 'inactive' | 'suspended';
export type DeviceType = 'android' | 'ios' | 'unknown';
export type AuthProviderName = 'google';

/**
 * One linked external auth account. Today only 'google' is supported.
 * The (provider, providerId) pair is GLOBALLY unique (enforced by a compound index
 * on authProviders.provider + authProviders.providerId) so the same Google account
 * cannot be attached to two users.
 */
export interface IAuthProvider {
  provider: AuthProviderName;
  /** The provider's stable id for this user (e.g. Google's `sub` claim). */
  providerId: string;
  /** Email reported by the provider at link time — informational, may go stale. */
  email?: string;
  linkedAt: Date;
}

export interface IUser {
  email: string;
  username: string;
  usernameLocked: boolean;
  status: UserStatus;
  deviceType: DeviceType;
  /** Optional contact number; not used for auth, not unique. */
  mobileNumber?: string;
  authProviders: IAuthProvider[];
  lastLogin: Date | null;
}

export interface IUserDocument extends IUser, Document {}

const AuthProviderSchema = new Schema<IAuthProvider>(
  {
    provider: {
      type: String,
      enum: ['google'],
      required: true,
    },
    providerId: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    linkedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // one account per email — builds its own index
      trim: true,
      lowercase: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: (props: { value: string }) =>
          `${props.value} is not a valid email address`,
      },
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true, // builds its own index
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    usernameLocked: {
      type: Boolean,
      default: false,
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
    mobileNumber: {
      type: String,
      default: null,
      validate: {
        // Optional, but if provided must be a 10-digit number.
        validator: (v: string | null) => v === null || v === undefined || /^[0-9]{10}$/.test(v),
        message: (props: { value: string }) =>
          `${props.value} is not a valid 10-digit mobile number`,
      },
    },
    authProviders: {
      type: [AuthProviderSchema],
      default: [],
      validate: {
        // Every user must have at least one linked provider — they can't exist otherwise.
        validator: (arr: IAuthProvider[]) => arr.length >= 1,
        message: 'User must have at least one linked auth provider',
      },
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

/**
 * Global uniqueness of (provider, providerId): the same external account
 * (e.g. a given Google id) cannot be linked to two different users. MongoDB
 * enforces this across all documents when the index is on an array subfield.
 */
UserSchema.index(
  { 'authProviders.provider': 1, 'authProviders.providerId': 1 },
  { unique: true }
);

UserSchema.index({ status: 1 });

const User: Model<IUserDocument> =
  mongoose.models.User ||
  mongoose.model<IUserDocument>('User', UserSchema);

export default User;