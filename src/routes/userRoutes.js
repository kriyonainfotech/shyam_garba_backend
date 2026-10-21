import { Router } from 'express';
import { getUsers } from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// Must be logged in (protect) AND be an admin (authorize)
router.get('/', protect, authorize('admin'), getUsers);

export default router;
