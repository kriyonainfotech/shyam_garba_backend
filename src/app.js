import express from 'express';
import cors from 'cors';
import { UPLOAD_DIR } from './config/paths.js';
import connectDB from './config/db.js';
import { releaseExpiredBookings } from './utils/bookings.js';
import { razorpayWebhook } from './controllers/bookingController.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import memberRoutes from './routes/memberRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import venueRoutes from './routes/venueRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import businessRoutes from './routes/businessRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import siteRoutes from './routes/siteRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Allow origins: CLIENT_URL, local dev, and vercel preview/prod deployments
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      if (
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.includes('localhost') ||
        cleanOrigin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Razorpay webhook needs the raw body to check its signature,
// so it is registered BEFORE express.json()
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), razorpayWebhook);

// Parse JSON request bodies into req.body
app.use(express.json());

// Uploaded images (member photos, event banners)
app.use('/uploads', express.static(UPLOAD_DIR));

// Root route for quick health/status check in browser
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shyam Garba API is running',
    timestamp: new Date().toISOString(),
  });
});

// Middleware to ensure database connection before handling API routes
let lastCleanup = 0;
const CLEANUP_EVERY_MS = 5 * 60 * 1000;

app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
    });
  }

  // Release expired unpaid bookings periodically
  if (Date.now() - lastCleanup > CLEANUP_EVERY_MS) {
    lastCleanup = Date.now();
    releaseExpiredBookings().catch((err) => console.error('Booking cleanup failed:', err.message));
  }

  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/site', siteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// These must come after all routes
app.use(notFound);
app.use(errorHandler);

export default app;
