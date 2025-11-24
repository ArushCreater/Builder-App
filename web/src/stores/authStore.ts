import { create } from 'zustand';

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

  login: async (email: string, _password: string) => {
    set({ isLoading: true, error: null });

    // Temporary: allow any credentials and create a local user
    const fakeUser: User = {
      id: crypto.randomUUID(),
      email,
      firstName: email.split('@')[0] || 'User',
      lastName: 'User',
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem('auth_token', 'demo-token');
    localStorage.setItem('auth_user', JSON.stringify(fakeUser));

    set({
      user: fakeUser,
      token: 'demo-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });

    const fakeUser: User = {
      id: crypto.randomUUID(),
      email: data.email,
      firstName: data.firstName || 'New',
      lastName: data.lastName || 'User',
      role: 'ADMIN',
      company: data.company,
      phone: data.phone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem('auth_token', 'demo-token');
    localStorage.setItem('auth_user', JSON.stringify(fakeUser));

    set({
      user: fakeUser,
      token: 'demo-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
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

    // Backend is disabled; treat any stored token as valid
    if (token && user) {
      set({ isAuthenticated: true, isLoading: false });
      return;
    }

    // No stored session; remain logged out without redirect enforcement
    set({ isAuthenticated: false, user: null, isLoading: false });
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
