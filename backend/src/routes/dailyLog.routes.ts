import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as dailyLogController from '../controllers/dailyLog.controller';

const router = Router();
router.use(authenticate);

router.get('/', dailyLogController.getAllDailyLogs);
router.post('/', dailyLogController.createDailyLog);
router.get('/:id', dailyLogController.getDailyLogById);
router.put('/:id', dailyLogController.updateDailyLog);
router.delete('/:id', dailyLogController.deleteDailyLog);

export default router;
