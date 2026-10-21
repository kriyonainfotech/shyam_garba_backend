import { Router } from 'express';
import { getMembers, getMembersMap, getMember } from '../controllers/memberController.js';
import { protect, approvedOnly } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect, approvedOnly);

router.get('/', getMembers);
router.get('/map', getMembersMap); // must be before /:id
router.get('/:id', getMember);

export default router;
