import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as taskController from '../controllers/task.controller';

const router = Router();
router.use(authenticate);

router.get('/', taskController.getAllTasks);
router.post('/', taskController.createTask);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

export default router;
