import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as budgetController from '../controllers/budget.controller';

const router = Router();
router.use(authenticate);

router.get('/', budgetController.getAllBudgets);
router.post('/', budgetController.createBudget);
router.get('/:id', budgetController.getBudgetById);
router.put('/:id', budgetController.updateBudget);
router.delete('/:id', budgetController.deleteBudget);

export default router;
