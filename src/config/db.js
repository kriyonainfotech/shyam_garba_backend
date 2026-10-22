import mongoose from 'mongoose';

let cachedPromise = null;

// Connects to MongoDB using the URI from .env.
// In serverless environments (like Vercel), we cache the connection
// across invocations to avoid exhausting MongoDB connection pools.
const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is missing in environment variables');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!cachedPromise) {
    cachedPromise = mongoose
      .connect(uri)
      .then((conn) => {
        console.log(`MongoDB connected: ${conn.connection.host}`);
        return conn;
      })
      .catch((err) => {
        cachedPromise = null;
        throw err;
      });
  }

  return cachedPromise;
};

export default connectDB;

