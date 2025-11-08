import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getAllLeads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const leads = await prisma.lead.findMany({
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } }, proposals: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ leads });
  } catch (error) {
    next(error);
  }
};

export const createLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const lead = await prisma.lead.create({
      data: { ...req.body, assignedToId: req.body.assignedToId || req.user!.id },
    });
    res.status(201).json({ lead });
  } catch (error) {
    next(error);
  }
};

export const getLeadById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { assignedTo: true, proposals: true },
    });
    if (!lead) throw new ApiError(404, 'Lead not found');
    res.json({ lead });
  } catch (error) {
    next(error);
  }
};

export const updateLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ lead });
  } catch (error) {
    next(error);
  }
};

export const deleteLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ message: 'Lead deleted' });
  } catch (error) {
    next(error);
  }
};

export const updateLeadStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
    });
    res.json({ lead });
  } catch (error) {
    next(error);
  }
};
