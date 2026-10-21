import { Router } from 'express';
import { getHomeData } from '../controllers/publicController.js';

const router = Router();

// Public website data, no token needed
router.get('/home', getHomeData);

export default router;
