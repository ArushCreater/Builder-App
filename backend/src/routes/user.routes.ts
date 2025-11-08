import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as userController from '../controllers/user.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all users (admin only)
router.get('/', authorize('ADMIN', 'PROJECT_MANAGER'), userController.getAllUsers);

// Get user by ID
router.get('/:id', userController.getUserById);

// Update user
router.put('/:id', userController.updateUser);

// Delete user (admin only)
router.delete('/:id', authorize('ADMIN'), userController.deleteUser);

// Update user status (admin only)
router.patch('/:id/status', authorize('ADMIN'), userController.updateUserStatus);

export default router;
