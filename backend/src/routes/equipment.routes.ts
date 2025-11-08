import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as equipmentController from '../controllers/equipment.controller';

const router = Router();
router.use(authenticate);

router.get('/', equipmentController.getAllEquipment);
router.post('/', equipmentController.createEquipment);
router.get('/:id', equipmentController.getEquipmentById);
router.put('/:id', equipmentController.updateEquipment);
router.delete('/:id', equipmentController.deleteEquipment);

export default router;
