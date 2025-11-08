import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllBudgets = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const budgets = await prisma.budget.findMany({
      include: {
        project: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ budgets });
  } catch (error) {
    next(error);
  }
};

export const createBudget = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const budget = await prisma.budget.create({
      data: {
        ...req.body,
        createdById: req.user!.id,
      },
    });
    res.status(201).json({ budget });
  } catch (error) {
    next(error);
  }
};

export const getBudgetById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const budget = await prisma.budget.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        createdBy: true,
      },
    });
    if (!budget) throw new ApiError(404, 'Budget not found');
    res.json({ budget });
  } catch (error) {
    next(error);
  }
};

export const updateBudget = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const budget = await prisma.budget.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ budget });
  } catch (error) {
    next(error);
  }
};

export const deleteBudget = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.budget.delete({ where: { id: req.params.id } });
    res.json({ message: 'Budget deleted' });
  } catch (error) {
    next(error);
  }
};
