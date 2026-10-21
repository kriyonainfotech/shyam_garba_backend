import 'dotenv/config'; // loads .env into process.env (must be first)
import app from './app.js';
import connectDB from './config/db.js';
import { releaseExpiredBookings } from './utils/bookings.js';

// All URLs and secrets come from .env, so stop early if any are missing
const REQUIRED_ENV = ['CLIENT_URL', 'MONGO_URI', 'JWT_SECRET'];

const PORT = process.env.PORT || 5000;

// Every 5 minutes, give back seats held by bookings that were never paid
const startCleanupTimer = () => {
  setInterval(() => {
    releaseExpiredBookings().catch((err) => console.error('Booking cleanup failed:', err.message));
  }, 5 * 60 * 1000);
};

const startServer = async () => {
  try {
    const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing in .env: ${missing.join(', ')}`);
    }

    await connectDB();
    startCleanupTimer();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
