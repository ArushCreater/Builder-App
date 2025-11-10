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

      // Call the AWS API for authentication
      const response = await apiClient.post<LoginResponse>('/auth/login', {
        email,
        password,
      });

      const { user, token } = response;

      // Persist to localStorage
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
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

      // Call the AWS API for registration
      const response = await apiClient.post<LoginResponse>('/auth/register', {
        ...data,
        role: 'USER', // Default role for new registrations
      });

      const { user, token } = response;

      // Persist to localStorage
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
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
    const { token } = get();

    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    try {
      // Validate token with API by fetching current user
      const response = await apiClient.get<{ user: User }>('/auth/me');
      const { user } = response;

      // Update stored user data
      localStorage.setItem('auth_user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      // Token is invalid, clear auth state
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
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
