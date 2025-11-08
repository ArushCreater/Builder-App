import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notifications = await prisma.notification.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
};

export const createNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notification = await prisma.notification.create({
      data: req.body,
    });
    res.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
};

export const getNotificationById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
      },
    });
    if (!notification) throw new ApiError(404, 'Notification not found');
    res.json({ notification });
  } catch (error) {
    next(error);
  }
};

export const updateNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ notification });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.delete({ where: { id: req.params.id } });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};
