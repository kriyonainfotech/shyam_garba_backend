import { Router } from 'express';
import {
  createEntry,
  getMyEntries,
  getMySummary,
  deleteEntry,
} from '../controllers/businessController.js';
import { protect, approvedOnly } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect, approvedOnly);

router.post('/', createEntry);
router.get('/', getMyEntries);
router.get('/summary', getMySummary);
router.delete('/:id', deleteEntry);

export default router;
