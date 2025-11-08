import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import leadRoutes from './routes/lead.routes';
import proposalRoutes from './routes/proposal.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import budgetRoutes from './routes/budget.routes';
import materialRoutes from './routes/material.routes';
import selectionRoutes from './routes/selection.routes';
import dailyLogRoutes from './routes/dailyLog.routes';
import messageRoutes from './routes/message.routes';
import documentRoutes from './routes/document.routes';
import inspectionRoutes from './routes/inspection.routes';
import bidRoutes from './routes/bid.routes';
import equipmentRoutes from './routes/equipment.routes';
import analyticsRoutes from './routes/analytics.routes';
import notificationRoutes from './routes/notification.routes';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Initialize express app
const app: Application = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Store io instance in app for access in routes
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join-project', (projectId: string) => {
    socket.join(`project-${projectId}`);
    logger.info(`Socket ${socket.id} joined project ${projectId}`);
  });

  socket.on('leave-project', (projectId: string) => {
    socket.leave(`project-${projectId}`);
    logger.info(`Socket ${socket.id} left project ${projectId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Response compression
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/selections', selectionRoutes);
app.use('/api/daily-logs', dailyLogRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { io };
