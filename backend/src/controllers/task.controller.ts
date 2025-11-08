import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllTasks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        project: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ tasks });
  } catch (error) {
    next(error);
  }
};

export const createTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await prisma.task.create({
      data: {
        ...req.body,
        createdById: req.user!.id,
      },
    });
    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
};

export const getTaskById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        assignedTo: true,
        createdBy: true,
      },
    });
    if (!task) throw new ApiError(404, 'Task not found');
    res.json({ task });
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ task });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
};
