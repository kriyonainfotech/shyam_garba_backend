import { Router } from 'express';
import { getNotifications, sendAnnouncement, deleteNotification } from '../controllers/notificationController.js';
import { protect, authorize, approvedOnly } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect, approvedOnly);

router.get('/', getNotifications);
router.post('/', authorize('admin'), sendAnnouncement);
router.delete('/:id', authorize('admin'), deleteNotification);

export default router;
