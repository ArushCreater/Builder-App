import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as leadController from '../controllers/lead.controller';

const router = Router();
router.use(authenticate);

router.get('/', leadController.getAllLeads);
router.post('/', leadController.createLead);
router.get('/:id', leadController.getLeadById);
router.put('/:id', leadController.updateLead);
router.delete('/:id', leadController.deleteLead);
router.patch('/:id/status', leadController.updateLeadStatus);

export default router;
