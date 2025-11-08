import { create } from 'zustand';
import { apiClient } from '../lib/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string;
  company?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company?: string;
  phone?: string;
}

interface LoginResponse {
  user: User;
  token: string;
}

type AuthStore = AuthState & AuthActions;

// Initialize state from localStorage
const getInitialState = (): AuthState => {
  const token = localStorage.getItem('auth_token');
  const userStr = localStorage.getItem('auth_user');
  const user = userStr ? JSON.parse(userStr) : null;

  return {
    user,
    token,
    isAuthenticated: !!(token && user),
    isLoading: false,
    error: null,
  };
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...getInitialState(),

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });

      // TEMPORARY: Skip authentication - accept any credentials
      const mockUser: User = {
        id: 'demo-user-123',
        email: email,
        firstName: email.split('@')[0].split('.')[0] || 'Demo',
        lastName: 'User',
        role: 'ADMIN',
        avatar: undefined,
        company: 'Demo Company',
        phone: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const mockToken = 'demo-token-' + Date.now();

      // Persist to localStorage
      localStorage.setItem('auth_token', mockToken);
      localStorage.setItem('auth_user', JSON.stringify(mockUser));

      set({
        user: mockUser,
        token: mockToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      set({
        error: error.message || 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  register: async (data: RegisterData) => {
    try {
      set({ isLoading: true, error: null });

      // TEMPORARY: Skip authentication - accept any registration
      const mockUser: User = {
        id: 'demo-user-' + Date.now(),
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'ADMIN',
        avatar: undefined,
        company: data.company,
        phone: data.phone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const mockToken = 'demo-token-' + Date.now();

      // Persist to localStorage
      localStorage.setItem('auth_token', mockToken);
      localStorage.setItem('auth_user', JSON.stringify(mockUser));

      set({
        user: mockUser,
        token: mockToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      set({
        error: error.message || 'Registration failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: () => {
    // Clear localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');

    // Reset state
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  setUser: (user: User) => {
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ user });
  },

  setToken: (token: string) => {
    localStorage.setItem('auth_token', token);
    set({ token, isAuthenticated: true });
  },

  clearError: () => {
    set({ error: null });
  },

  checkAuth: async () => {
    const { token, user } = get();

    if (!token || !user) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    // TEMPORARY: Skip API validation - just use stored user
    set({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  updateUser: async (data: Partial<User>) => {
    try {
      set({ isLoading: true, error: null });

      // TEMPORARY: Skip API - just update local user
      const currentUser = get().user;
      if (!currentUser) {
        throw new Error('No user logged in');
      }

      const updatedUser = {
        ...currentUser,
        ...data,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem('auth_user', JSON.stringify(updatedUser));

      set({
        user: updatedUser,
        isLoading: false,
      });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update user',
        isLoading: false,
      });
      throw error;
    }
  },
}));
