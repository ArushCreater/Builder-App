import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as messageController from '../controllers/message.controller';

const router = Router();
router.use(authenticate);

router.get('/', messageController.getAllMessages);
router.post('/', messageController.createMessage);
router.get('/:id', messageController.getMessageById);
router.put('/:id', messageController.updateMessage);
router.delete('/:id', messageController.deleteMessage);

export default router;
