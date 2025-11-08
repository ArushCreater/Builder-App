import { z } from 'zod';

// User validation schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  company: z.string().optional(),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'CLIENT', 'SUBCONTRACTOR', 'FIELD_WORKER', 'ACCOUNTANT']),
});

// Lead validation schemas
export const createLeadSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  source: z.string().min(1, 'Source is required'),
  estimatedValue: z.number().optional(),
  notes: z.string().optional(),
  assignedToId: z.string(),
});

// Project validation schemas
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  type: z.string().min(1, 'Project type is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'Zip code is required'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  estimatedBudget: z.number().min(0, 'Budget must be positive'),
});

// Task validation schemas
export const createTaskSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assignedToId: z.string().optional(),
  startDate: z.date().optional(),
  dueDate: z.date().optional(),
  estimatedHours: z.number().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
