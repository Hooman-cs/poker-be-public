import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

if (!DB_NAME) {
  throw new Error('Please define the DB_NAME environment variable inside .env.local');
}

let cachedClient = null;
let cachedDb = null;

export default async function dbConnect() {
  if (cachedClient && cachedDb) {
    // Use existing database connection
    console.log("=> Using existing database connection");
    return cachedDb;
  }

  // Create new database connection
  try {
    const client = await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true,
       
    });

    const db = client.connection.db;
    cachedClient = client;
    cachedDb = db;

    console.log("=> New database connection");

    return db;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
}
