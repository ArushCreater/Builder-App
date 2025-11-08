import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as bidController from '../controllers/bid.controller';

const router = Router();
router.use(authenticate);

router.get('/', bidController.getAllBids);
router.post('/', bidController.createBid);
router.get('/:id', bidController.getBidById);
router.put('/:id', bidController.updateBid);
router.delete('/:id', bidController.deleteBid);

export default router;
