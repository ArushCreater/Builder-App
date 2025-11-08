import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as materialController from '../controllers/material.controller';

const router = Router();
router.use(authenticate);

router.get('/', materialController.getAllMaterials);
router.post('/', materialController.createMaterial);
router.get('/:id', materialController.getMaterialById);
router.put('/:id', materialController.updateMaterial);
router.delete('/:id', materialController.deleteMaterial);

export default router;
