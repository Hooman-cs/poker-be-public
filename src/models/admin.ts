import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';  // Import bcrypt for password hashing

// Define the TypeScript interface for the Admin document
interface IAdmin extends Document {
  name: string;
  mobile: string;
  token?: string; // Token is optional
  status: 'active' | 'inactive';
  role: 'superadmin' | 'editor' | 'viewer'; // Different roles for admin
  lastLogin?: Date | null; // lastLogin is optional and can be null
  email?: string; // Email is optional
  password: string; // Password is required
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the schema for the Admin model
const AdminSchema: Schema<IAdmin> = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      unique: true,
    },
    token: {
      type: String,
      default: '', // Set a default value for token
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true,
    },
    role: {
      type: String,
      enum: ['superadmin', 'editor', 'viewer'], // Enum to allow only specified roles
      default: 'editor',
    },
    lastLogin: {
      type: Date,
      default: null, // Initialized as null until the first login
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      required: true, // Password is required
      minlength: 6, // Password length validation
    },
  },
  {
    timestamps: true, // Automatically handles createdAt and updatedAt
  }
);

// Hash the password before saving the admin document
AdminSchema.pre<IAdmin>('save', async function (next) {
  if (this.isModified('password')) {
    // Hash password before saving if it is modified or new
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Create the Admin model if it doesn’t already exist
const Admin: Model<IAdmin> = mongoose.models.Admin || mongoose.model<IAdmin>('Admin', AdminSchema);

export default Admin;
