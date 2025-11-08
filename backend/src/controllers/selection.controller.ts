import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllSelections = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const selections = await prisma.selection.findMany({
      include: {
        project: true,
        selectedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ selections });
  } catch (error) {
    next(error);
  }
};

export const createSelection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const selection = await prisma.selection.create({
      data: {
        ...req.body,
        selectedById: req.body.selectedById || req.user!.id,
      },
    });
    res.status(201).json({ selection });
  } catch (error) {
    next(error);
  }
};

export const getSelectionById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const selection = await prisma.selection.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        selectedBy: true,
      },
    });
    if (!selection) throw new ApiError(404, 'Selection not found');
    res.json({ selection });
  } catch (error) {
    next(error);
  }
};

export const updateSelection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const selection = await prisma.selection.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ selection });
  } catch (error) {
    next(error);
  }
};

export const deleteSelection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.selection.delete({ where: { id: req.params.id } });
    res.json({ message: 'Selection deleted' });
  } catch (error) {
    next(error);
  }
};
