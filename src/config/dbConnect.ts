
/**
 * @fileoverview MongoDB connection configuration.
 * Implements global caching to prevent connection exhaustion 
 * during Next.js Hot Module Replacement (HMR).
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

if (!DB_NAME) {
  throw new Error('Please define the DB_NAME environment variable inside .env.local');
}

/**
 * Global is used here to maintain a cached connection across hot reloads in development.
 * This prevents connections growing exponentially during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export default async function dbConnect(): Promise<mongoose.Connection> {
  if (cached.conn) {
    console.log("=> Using existing database connection");
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      dbName: DB_NAME,
      bufferCommands: false,
      // Note: useNewUrlParser and useUnifiedTopology are removed as they are deprecated in Mongoose 6+
    };

    console.log("=> Creating new database connection");
    cached.promise = mongoose.connect(MONGODB_URI as string, opts).then((mongooseInstance) => {
      return mongooseInstance.connection;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}