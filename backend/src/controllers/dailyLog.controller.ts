import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllDailyLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dailyLogs = await prisma.dailyLog.findMany({
      include: {
        project: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { date: 'desc' },
    });
    res.json({ dailyLogs });
  } catch (error) {
    next(error);
  }
};

export const createDailyLog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dailyLog = await prisma.dailyLog.create({
      data: {
        ...req.body,
        createdById: req.user!.id,
      },
    });
    res.status(201).json({ dailyLog });
  } catch (error) {
    next(error);
  }
};

export const getDailyLogById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dailyLog = await prisma.dailyLog.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        createdBy: true,
      },
    });
    if (!dailyLog) throw new ApiError(404, 'Daily log not found');
    res.json({ dailyLog });
  } catch (error) {
    next(error);
  }
};

export const updateDailyLog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dailyLog = await prisma.dailyLog.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ dailyLog });
  } catch (error) {
    next(error);
  }
};

export const deleteDailyLog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.dailyLog.delete({ where: { id: req.params.id } });
    res.json({ message: 'Daily log deleted' });
  } catch (error) {
    next(error);
  }
};
