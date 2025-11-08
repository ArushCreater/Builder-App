import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as inspectionController from '../controllers/inspection.controller';

const router = Router();
router.use(authenticate);

router.get('/', inspectionController.getAllInspections);
router.post('/', inspectionController.createInspection);
router.get('/:id', inspectionController.getInspectionById);
router.put('/:id', inspectionController.updateInspection);
router.delete('/:id', inspectionController.deleteInspection);

export default router;
