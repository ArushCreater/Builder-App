import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as analyticsController from '../controllers/analytics.controller';

const router = Router();
router.use(authenticate);

router.get('/', analyticsController.getAllAnalytics);
router.post('/', analyticsController.createAnalytics);
router.get('/:id', analyticsController.getAnalyticsById);
router.put('/:id', analyticsController.updateAnalytics);
router.delete('/:id', analyticsController.deleteAnalytics);

export default router;
