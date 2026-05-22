/**
 * @fileoverview OTP Model
 * Handles one-time passwords for user mobile authentication.
 * Rate limiting logic lives in: src/app/api/auth/otp/request/route.ts
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// -----------------------------------------------------------------------------
// Interface
// -----------------------------------------------------------------------------

export interface IOtp {
  mobileNumber: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
  requestCount: number;
  blockedUntil: Date | null;
}

export interface IOtpDocument extends IOtp, Document {}

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

const OtpSchema = new Schema<IOtpDocument>(
  {
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      validate: {
        validator: (v: string) => /^[0-9]{10}$/.test(v),
        message: (props: { value: string }) =>
          `${props.value} is not a valid 10-digit mobile number`,
      },
    },
    otp: {
      type: String,
      required: [true, 'OTP is required'],
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
    requestCount: {
      type: Number,
      default: 1,
      min: [0, 'Request count cannot be negative'],
    },
    blockedUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  }
);

// -----------------------------------------------------------------------------
// Indexes
// -----------------------------------------------------------------------------

// Auto-delete document when expiresAt is reached
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Fast lookup by mobile number
OtpSchema.index({ mobileNumber: 1 });

// -----------------------------------------------------------------------------
// Model
// -----------------------------------------------------------------------------

const Otp: Model<IOtpDocument> =
  mongoose.models.Otp || mongoose.model<IOtpDocument>('Otp', OtpSchema);

export default Otp;
// /**
//  * @fileoverview OTP Database Model
//  * Handles temporary One-Time Passwords for mobile authentication.
//  * Includes a TTL index for automatic document expiration.
//  */

// import mongoose, { Schema, Document, Model } from 'mongoose';
// import { IOtp } from '@/utils/pokerModelTypes';

// // 1. Strict Types for the Mongoose Document
// // Since IOtp does not have an '_id' field defined, it extends cleanly without Omit.
// export interface IOtpDocument extends IOtp, Document {}

// // 2. Schema Definition
// const OtpSchema: Schema<IOtpDocument> = new Schema({
//   mobileNumber: {
//     type: String,
//     required: true,
//     validate: {
//       validator: (v: string) => /^[0-9]{10}$/.test(v),
//       message: (props: { value: string }) => `${props.value} is not a valid mobile number!`,
//     },
//   },
//   otp: {
//     type: String,
//     required: true,
//   },
//   expiresAt: {
//     type: Date,
//     required: true,
//     default: () => new Date(Date.now() + 10 * 60 * 1000), // OTP expires in 10 minutes
//   },
//   createdAt: {
//     type: Date,
//     required: true,
//     default: Date.now,
//   },
//   requestCount: {
//     type: Number,
//     required: true,
//     default: 1,
//   },
//   blockedUntil: {
//     type: Date,
//     default: null,
//   },
// });

// // 3. TTL Index (Automatically deletes documents when expiresAt is reached)
// OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// // 4. Model Export
// const Otp: Model<IOtpDocument> = 
//   mongoose.models.Otp || mongoose.model<IOtpDocument>('Otp', OtpSchema);

// export default Otp;