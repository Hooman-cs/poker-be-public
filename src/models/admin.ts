/**
 * @fileoverview Admin Database Model
 * Encapsulates the schema, cryptographic password hashing, and validation methods.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

// 1. Strict Types for the Raw Data
export interface IAdmin {
  name: string;
  mobile: string;
  token?: string;
  status: 'active' | 'inactive';
  role: 'superadmin' | 'editor' | 'viewer';
  lastLogin?: Date | null;
  email?: string;
  password: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Strict Types for the Mongoose Document (includes instance methods)
export interface IAdminDocument extends IAdmin, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// 3. Schema Definition
const AdminSchema: Schema<IAdminDocument> = new Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true },
    token: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    role: { type: String, enum: ['superadmin', 'editor', 'viewer'], default: 'editor' },
    lastLogin: { type: Date, default: null },
    email: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
  },
  {
    timestamps: true,
  }
);

// 4. Pre-Save Hook: Hash Password
AdminSchema.pre<IAdminDocument>('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// 5. Instance Method: Compare Password
AdminSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// 6. Model Export
const Admin: Model<IAdminDocument> = mongoose.models.Admin || mongoose.model<IAdminDocument>('Admin', AdminSchema);

export default Admin;
// import mongoose, { Schema, Document, Model } from 'mongoose';
// import bcrypt from 'bcryptjs';  // Import bcrypt for password hashing

// // Define the TypeScript interface for the Admin document
// interface IAdmin extends Document {
//   name: string;
//   mobile: string;
//   token?: string; // Token is optional
//   status: 'active' | 'inactive';
//   role: 'superadmin' | 'editor' | 'viewer'; // Different roles for admin
//   lastLogin?: Date | null; // lastLogin is optional and can be null
//   email?: string; // Email is optional
//   password: string; // Password is required
//   createdAt?: Date;
//   updatedAt?: Date;
// }

// // Define the schema for the Admin model
// const AdminSchema: Schema<IAdmin> = new Schema(
//   {
//     name: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     mobile: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     token: {
//       type: String,
//       default: '', // Set a default value for token
//     },
//     status: {
//       type: String,
//       enum: ['active', 'inactive'],
//       default: 'active',
//       required: true,
//     },
//     role: {
//       type: String,
//       enum: ['superadmin', 'editor', 'viewer'], // Enum to allow only specified roles
//       default: 'editor',
//     },
//     lastLogin: {
//       type: Date,
//       default: null, // Initialized as null until the first login
//     },
//     email: {
//       type: String,
//       unique: true,
//       sparse: true,
//       trim: true,
//     },
//     password: {
//       type: String,
//       required: true, // Password is required
//       minlength: 6, // Password length validation
//     },
//   },
//   {
//     timestamps: true, // Automatically handles createdAt and updatedAt
//   }
// );

// // Hash the password before saving the admin document
// AdminSchema.pre<IAdmin>('save', async function (next) {
//   if (this.isModified('password')) {
//     // Hash password before saving if it is modified or new
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//   }
//   next();
// });

// // Create the Admin model if it doesn’t already exist
// const Admin: Model<IAdmin> = mongoose.models.Admin || mongoose.model<IAdmin>('Admin', AdminSchema);

// export default Admin;
