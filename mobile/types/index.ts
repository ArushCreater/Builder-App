export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'project_manager' | 'contractor' | 'client';
  avatar?: string;
  phone?: string;
  company?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  address: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  budget?: number;
  client: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  projectManager: {
    id: string;
    name: string;
    email: string;
  };
  progress: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  dueDate?: string;
  startDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLog {
  id: string;
  projectId: string;
  date: string;
  weather?: {
    condition: string;
    temperature: number;
    description?: string;
  };
  workPerformed: string;
  manpower: {
    contractors: number;
    subcontractors: number;
    visitors: number;
  };
  materials?: string;
  equipment?: string;
  safetyIncidents?: string;
  notes?: string;
  photos: Photo[];
  location?: {
    latitude: number;
    longitude: number;
  };
  createdBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  takenAt: string;
  uploadedBy: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export interface Document {
  id: string;
  projectId: string;
  name: string;
  type: 'contract' | 'blueprint' | 'permit' | 'invoice' | 'other';
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  userId: string;
  taskId?: string;
  description?: string;
  hours: number;
  date: string;
  billable: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  company?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type TabParamList = {
  index: undefined;
  projects: undefined;
  tasks: undefined;
  'daily-logs': undefined;
  more: undefined;
};

export type RootStackParamList = {
  '(app)': undefined;
  '(auth)': undefined;
  'project-detail': { projectId: string };
  'task-detail': { taskId: string };
  'daily-log-form': { projectId: string; logId?: string };
  'photo-gallery': { projectId: string };
  'documents': { projectId: string };
};
