import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('role').isIn(['ADMIN', 'PROJECT_MANAGER', 'CLIENT', 'SUBCONTRACTOR', 'FIELD_WORKER', 'ACCOUNTANT']),
  ],
  authController.register
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  authController.login
);

// Get current user
router.get('/me', authenticate, authController.getCurrentUser);

// Refresh token
router.post('/refresh', authController.refreshToken);

// Logout
router.post('/logout', authenticate, authController.logout);

// Password reset request
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  authController.forgotPassword
);

// Password reset
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }),
  ],
  authController.resetPassword
);

export default router;
