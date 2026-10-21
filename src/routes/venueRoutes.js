import { Router } from 'express';
import {
  getVenues,
  getVenue,
  createVenue,
  updateVenue,
  deleteVenue,
} from '../controllers/venueController.js';
import { protect, authorize, approvedOnly } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect, approvedOnly);

router.get('/', getVenues);
router.get('/:id', getVenue);
router.post('/', authorize('admin'), createVenue);
router.put('/:id', authorize('admin'), updateVenue);
router.delete('/:id', authorize('admin'), deleteVenue);

export default router;
