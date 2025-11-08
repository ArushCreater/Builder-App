import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllProposals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposals = await prisma.proposal.findMany({
      include: {
        lead: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ proposals });
  } catch (error) {
    next(error);
  }
};

export const createProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposal = await prisma.proposal.create({
      data: {
        ...req.body,
        createdById: req.user!.id,
      },
    });
    res.status(201).json({ proposal });
  } catch (error) {
    next(error);
  }
};

export const getProposalById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: req.params.id },
      include: {
        lead: true,
        createdBy: true,
        project: true,
      },
    });
    if (!proposal) throw new ApiError(404, 'Proposal not found');
    res.json({ proposal });
  } catch (error) {
    next(error);
  }
};

export const updateProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposal = await prisma.proposal.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ proposal });
  } catch (error) {
    next(error);
  }
};

export const deleteProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.proposal.delete({ where: { id: req.params.id } });
    res.json({ message: 'Proposal deleted' });
  } catch (error) {
    next(error);
  }
};
