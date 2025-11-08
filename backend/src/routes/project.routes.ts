import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as projectController from '../controllers/project.controller';

const router = Router();
router.use(authenticate);

router.get('/', projectController.getAllProjects);
router.post('/', projectController.createProject);
router.get('/:id', projectController.getProjectById);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

export default router;
