import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllEquipment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const equipment = await prisma.equipment.findMany({
      include: {
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ equipment });
  } catch (error) {
    next(error);
  }
};

export const createEquipment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const equipment = await prisma.equipment.create({
      data: req.body,
    });
    res.status(201).json({ equipment });
  } catch (error) {
    next(error);
  }
};

export const getEquipmentById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
      },
    });
    if (!equipment) throw new ApiError(404, 'Equipment not found');
    res.json({ equipment });
  } catch (error) {
    next(error);
  }
};

export const updateEquipment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const equipment = await prisma.equipment.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ equipment });
  } catch (error) {
    next(error);
  }
};

export const deleteEquipment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.equipment.delete({ where: { id: req.params.id } });
    res.json({ message: 'Equipment deleted' });
  } catch (error) {
    next(error);
  }
};
