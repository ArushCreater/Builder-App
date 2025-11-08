import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllMaterials = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const materials = await prisma.material.findMany({
      include: {
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ materials });
  } catch (error) {
    next(error);
  }
};

export const createMaterial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const material = await prisma.material.create({
      data: req.body,
    });
    res.status(201).json({ material });
  } catch (error) {
    next(error);
  }
};

export const getMaterialById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
      },
    });
    if (!material) throw new ApiError(404, 'Material not found');
    res.json({ material });
  } catch (error) {
    next(error);
  }
};

export const updateMaterial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const material = await prisma.material.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ material });
  } catch (error) {
    next(error);
  }
};

export const deleteMaterial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.material.delete({ where: { id: req.params.id } });
    res.json({ message: 'Material deleted' });
  } catch (error) {
    next(error);
  }
};
