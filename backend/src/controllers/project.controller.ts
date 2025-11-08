import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        proposal: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
        client: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ projects });
  } catch (error) {
    next(error);
  }
};

export const createProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const project = await prisma.project.create({
      data: req.body,
    });
    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        proposal: true,
        manager: true,
        client: true,
        tasks: true,
        budgets: true,
        dailyLogs: true,
      },
    });
    if (!project) throw new ApiError(404, 'Project not found');
    res.json({ project });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ project });
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
};
