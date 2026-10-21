import { Router } from 'express';
import {
  getDashboard,
  getMembers,
  exportMembers,
  getMember,
  updateMemberStatus,
  updateMember,
  deleteMember,
  getActivity,
  getBusinessReport,
  getPayments,
  getEventsReport,
  deleteActivity,
  getBusinessEntries,
  deleteBusinessEntry,
  deleteBooking,
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// Everything here is for the Super Admin website only
router.use(protect, authorize('admin'));

router.get('/dashboard', getDashboard);

router.get('/members', getMembers);
router.get('/members/export', exportMembers); // must be before /members/:id
router.get('/members/:id', getMember);
router.patch('/members/:id/status', updateMemberStatus);
router.put('/members/:id', updateMember);
router.delete('/members/:id', deleteMember);

router.get('/activity', getActivity);
router.delete('/activity/:id', deleteActivity);
router.get('/business/report', getBusinessReport);
router.get('/business/entries', getBusinessEntries);
router.delete('/business/entries/:id', deleteBusinessEntry);
router.get('/payments', getPayments);
router.delete('/bookings/:id', deleteBooking);
router.get('/events/report', getEventsReport);

export default router;
