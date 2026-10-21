import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  getItems,
  createItem,
  updateItem,
  deleteItem,
  uploadSiteImage,
} from '../controllers/siteController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import uploadImage from '../middleware/upload.js';

const router = Router();

// Admin "Website" section: everything shown on the public website
router.use(protect, authorize('admin'));

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

router.get('/items', getItems);
router.post('/items', createItem);
router.put('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);

// Website images can be bigger than member photos (hero backgrounds)
router.post('/upload', uploadImage('site', 'image', 5), uploadSiteImage);


export default router;
