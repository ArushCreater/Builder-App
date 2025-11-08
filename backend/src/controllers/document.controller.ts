import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const documents = await prisma.document.findMany({
      include: {
        project: true,
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ documents });
  } catch (error) {
    next(error);
  }
};

export const createDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.create({
      data: {
        ...req.body,
        uploadedById: req.user!.id,
      },
    });
    res.status(201).json({ document });
  } catch (error) {
    next(error);
  }
};

export const getDocumentById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        uploadedBy: true,
      },
    });
    if (!document) throw new ApiError(404, 'Document not found');
    res.json({ document });
  } catch (error) {
    next(error);
  }
};

export const updateDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ document });
  } catch (error) {
    next(error);
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
};
