import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as proposalController from '../controllers/proposal.controller';

const router = Router();
router.use(authenticate);

router.get('/', proposalController.getAllProposals);
router.post('/', proposalController.createProposal);
router.get('/:id', proposalController.getProposalById);
router.put('/:id', proposalController.updateProposal);
router.delete('/:id', proposalController.deleteProposal);

export default router;
