import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllInspections = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const inspections = await prisma.inspection.findMany({
      include: {
        project: true,
        inspector: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    });
    res.json({ inspections });
  } catch (error) {
    next(error);
  }
};

export const createInspection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const inspection = await prisma.inspection.create({
      data: req.body,
    });
    res.status(201).json({ inspection });
  } catch (error) {
    next(error);
  }
};

export const getInspectionById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const inspection = await prisma.inspection.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        inspector: true,
      },
    });
    if (!inspection) throw new ApiError(404, 'Inspection not found');
    res.json({ inspection });
  } catch (error) {
    next(error);
  }
};

export const updateInspection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const inspection = await prisma.inspection.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ inspection });
  } catch (error) {
    next(error);
  }
};

export const deleteInspection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.inspection.delete({ where: { id: req.params.id } });
    res.json({ message: 'Inspection deleted' });
  } catch (error) {
    next(error);
  }
};
