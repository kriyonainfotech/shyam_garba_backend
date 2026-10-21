import { Router } from 'express';
import {
  register,
  login,
  googleLogin,
  getMe,
  saveFcmToken,
  removeFcmToken,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/google', googleLogin); // mobile app
router.post('/register', register);
router.post('/login', login); // admin website
router.get('/me', protect, getMe);
router.post('/fcm-token', protect, saveFcmToken);
router.delete('/fcm-token', protect, removeFcmToken);

export default router;
