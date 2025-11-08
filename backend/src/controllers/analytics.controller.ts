import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const analytics = await prisma.analytics.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ analytics });
  } catch (error) {
    next(error);
  }
};

export const createAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const analytics = await prisma.analytics.create({
      data: req.body,
    });
    res.status(201).json({ analytics });
  } catch (error) {
    next(error);
  }
};

export const getAnalyticsById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const analytics = await prisma.analytics.findUnique({
      where: { id: req.params.id },
    });
    if (!analytics) throw new ApiError(404, 'Analytics not found');
    res.json({ analytics });
  } catch (error) {
    next(error);
  }
};

export const updateAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const analytics = await prisma.analytics.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ analytics });
  } catch (error) {
    next(error);
  }
};

export const deleteAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.analytics.delete({ where: { id: req.params.id } });
    res.json({ message: 'Analytics deleted' });
  } catch (error) {
    next(error);
  }
};
