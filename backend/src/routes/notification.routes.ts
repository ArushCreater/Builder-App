import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as notificationController from '../controllers/notification.controller';

const router = Router();
router.use(authenticate);

router.get('/', notificationController.getAllNotifications);
router.post('/', notificationController.createNotification);
router.get('/:id', notificationController.getNotificationById);
router.put('/:id', notificationController.updateNotification);
router.delete('/:id', notificationController.deleteNotification);

export default router;
