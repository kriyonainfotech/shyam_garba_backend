import { Router } from 'express';
import {
  createBooking,
  verifyPayment,
  getMyBookings,
  getBooking,
} from '../controllers/bookingController.js';
import { protect, approvedOnly } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect, approvedOnly);

router.post('/', createBooking);
router.post('/verify-payment', verifyPayment);
router.get('/my', getMyBookings); // must be before /:id
router.get('/:id', getBooking);

export default router;
