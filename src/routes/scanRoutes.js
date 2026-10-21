import { Router } from 'express';
import { getScanAccess, getMyScanEvents, verifyPass } from '../controllers/scanController.js';
import { protect, approvedOnly } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect, approvedOnly);

router.post('/access', getScanAccess);
router.get('/events', getMyScanEvents);
router.post('/verify', verifyPass);

export default router;
