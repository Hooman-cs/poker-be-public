/**
 * @fileoverview Admin Model
 * Handles admin account authentication and management.
 * Admin login is via email and password.
 * JWT is stored in httpOnly cookie, not in the database.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAdmin {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: 'admin';
  status: 'active' | 'inactive';
  lastLogin: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAdminDocument extends IAdmin, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AdminSchema = new Schema<IAdminDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: (props: { value: string }) =>
          `${props.value} is not a valid email address`,
      },
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      validate: {
        validator: (v: string) => /^[0-9]{10}$/.test(v),
        message: (props: { value: string }) =>
          `${props.value} is not a valid 10-digit mobile number`,
      },
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [12, 'Password must be at least 12 characters'],
    },
    role: {
      type: String,
      enum: ['admin'],
      default: 'admin',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
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

AdminSchema.pre<IAdminDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

AdminSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const Admin: Model<IAdminDocument> =
  mongoose.models.Admin || mongoose.model<IAdminDocument>('Admin', AdminSchema);

export default Admin;