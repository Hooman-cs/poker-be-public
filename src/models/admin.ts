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
// /**
//  * @fileoverview Admin Database Model
//  * Encapsulates the schema, cryptographic password hashing, and validation methods.
//  */

// import mongoose, { Schema, Document, Model } from 'mongoose';
// import bcrypt from 'bcryptjs';

// // 1. Strict Types for the Raw Data
// export interface IAdmin {
//   name: string;
//   mobile: string;
//   token?: string;
//   status: 'active' | 'inactive';
//   role: 'superadmin' | 'editor' | 'viewer';
//   lastLogin?: Date | null;
//   email?: string;
//   password: string;
//   createdAt?: Date;
//   updatedAt?: Date;
// }

// // 2. Strict Types for the Mongoose Document (includes instance methods)
// export interface IAdminDocument extends IAdmin, Document {
//   comparePassword(candidatePassword: string): Promise<boolean>;
// }

// // 3. Schema Definition
// const AdminSchema: Schema<IAdminDocument> = new Schema(
//   {
//     name: { type: String, required: true, trim: true },
//     mobile: { type: String, required: true, unique: true },
//     token: { type: String, default: '' },
//     status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
//     role: { type: String, enum: ['superadmin', 'editor', 'viewer'], default: 'editor' },
//     lastLogin: { type: Date, default: null },
//     email: { type: String, unique: true, sparse: true, trim: true },
//     password: { type: String, required: true, minlength: 6 },
//   },
//   {
//     timestamps: true,
//   }
// );

// // 4. Pre-Save Hook: Hash Password
// AdminSchema.pre<IAdminDocument>('save', async function (next) {
//   if (this.isModified('password')) {
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//   }
//   next();
// });

// // 5. Instance Method: Compare Password
// AdminSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
//   return bcrypt.compare(candidatePassword, this.password);
// };

// // 6. Model Export
// const Admin: Model<IAdminDocument> = mongoose.models.Admin || mongoose.model<IAdminDocument>('Admin', AdminSchema);

// export default Admin;