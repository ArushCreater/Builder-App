import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllBids = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bids = await prisma.bid.findMany({
      include: {
        project: true,
        vendor: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ bids });
  } catch (error) {
    next(error);
  }
};

export const createBid = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bid = await prisma.bid.create({
      data: req.body,
    });
    res.status(201).json({ bid });
  } catch (error) {
    next(error);
  }
};

export const getBidById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bid = await prisma.bid.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        vendor: true,
      },
    });
    if (!bid) throw new ApiError(404, 'Bid not found');
    res.json({ bid });
  } catch (error) {
    next(error);
  }
};

export const updateBid = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bid = await prisma.bid.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ bid });
  } catch (error) {
    next(error);
  }
};

export const deleteBid = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.bid.delete({ where: { id: req.params.id } });
    res.json({ message: 'Bid deleted' });
  } catch (error) {
    next(error);
  }
};
