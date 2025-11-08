import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as selectionController from '../controllers/selection.controller';

const router = Router();
router.use(authenticate);

router.get('/', selectionController.getAllSelections);
router.post('/', selectionController.createSelection);
router.get('/:id', selectionController.getSelectionById);
router.put('/:id', selectionController.updateSelection);
router.delete('/:id', selectionController.deleteSelection);

export default router;
