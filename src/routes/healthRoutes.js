import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

// GET /api/health -> confirms the server is running and shows DB status
router.get('/', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    success: true,
    message: 'Server is running',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

export default router;
