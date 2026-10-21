import { Router } from 'express';
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadBanner,
  regenerateScanCode,
  getEventStats,
  getEventBookings,
  exportEventBookings,
} from '../controllers/eventController.js';
import { protect, authorize, approvedOnly } from '../middleware/authMiddleware.js';
import uploadImage from '../middleware/upload.js';

const router = Router();
const admin = authorize('admin');

router.use(protect, approvedOnly);

router.get('/', getEvents);
router.get('/:id', getEvent);

router.post('/', admin, createEvent);
router.put('/:id', admin, updateEvent);
router.delete('/:id', admin, deleteEvent);
router.post('/:id/banner', admin, uploadImage('banners', 'banner'), uploadBanner);
router.post('/:id/scan-code', admin, regenerateScanCode);
router.get('/:id/stats', admin, getEventStats);
router.get('/:id/bookings', admin, getEventBookings);
router.get('/:id/bookings/export', admin, exportEventBookings);

export default router;
