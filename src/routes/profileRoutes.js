import { Router } from 'express';
import { getProfile, updateProfile, uploadPhoto } from '../controllers/profileController.js';
import { protect } from '../middleware/authMiddleware.js';
import uploadImage from '../middleware/upload.js';

const router = Router();

// Pending members may fill their profile while waiting for approval
router.use(protect);

router.get('/', getProfile);
router.put('/', updateProfile);
router.post('/photo', uploadImage('photos', 'photo'), uploadPhoto);

export default router;
