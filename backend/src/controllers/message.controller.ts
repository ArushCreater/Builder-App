import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const messages = await prisma.message.findMany({
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
        receiver: { select: { id: true, firstName: true, lastName: true } },
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ messages });
  } catch (error) {
    next(error);
  }
};

export const createMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const message = await prisma.message.create({
      data: {
        ...req.body,
        senderId: req.user!.id,
      },
    });
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
};

export const getMessageById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const message = await prisma.message.findUnique({
      where: { id: req.params.id },
      include: {
        sender: true,
        receiver: true,
        project: true,
      },
    });
    if (!message) throw new ApiError(404, 'Message not found');
    res.json({ message });
  } catch (error) {
    next(error);
  }
};

export const updateMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const message = await prisma.message.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ message });
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.message.delete({ where: { id: req.params.id } });
    res.json({ message: 'Message deleted' });
  } catch (error) {
    next(error);
  }
};
