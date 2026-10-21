import mongoose from 'mongoose';

// Connects to MongoDB using the URI from .env.
// Throws if the connection fails, so server.js can stop the app.
const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is missing in .env');
  }

  const conn = await mongoose.connect(uri);
  console.log(`MongoDB connected: ${conn.connection.host}`);
};

export default connectDB;
