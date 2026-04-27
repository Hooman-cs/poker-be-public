import mongoose, { Schema, Document } from 'mongoose';

export interface IOtp extends Document {
  mobileNumber: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
  requestCount: number;
  blockedUntil: Date | null; // Field to track the block time
}

const OtpSchema: Schema<IOtp> = new Schema({
  mobileNumber: {
    type: String,
    required: true,
    validate: {
      validator: (v: string) => /^[0-9]{10}$/.test(v),
      message: (props: { value: string }) => `${props.value} is not a valid mobile number!`,
    },
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => Date.now() + 10 * 60 * 1000, // OTP expires in 10 minutes
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now, // Automatically set createdAt to the current time
  },
  requestCount: {
    type: Number,
    required: true,
    default: 1, // Initialize requestCount to 1 on creation
  },
  blockedUntil: {
    type: Date,
    default: null, // Initially not blocked
  },
});

OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.models.Otp || mongoose.model<IOtp>('Otp', OtpSchema);

export default Otp;
