import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as documentController from '../controllers/document.controller';

const router = Router();
router.use(authenticate);

router.get('/', documentController.getAllDocuments);
router.post('/', documentController.createDocument);
router.get('/:id', documentController.getDocumentById);
router.put('/:id', documentController.updateDocument);
router.delete('/:id', documentController.deleteDocument);

export default router;
