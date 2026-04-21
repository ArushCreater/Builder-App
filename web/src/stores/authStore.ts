import { create } from 'zustand';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

const toAppUser = (su: SupabaseUser): User => {
  const meta = (su.user_metadata || {}) as Record<string, any>;
  const email = su.email || '';
  const emailPrefix = email.split('@')[0] || 'User';
  return {
    id: su.id,
    email,
    firstName: meta.firstName || meta.first_name || emailPrefix,
    lastName: meta.lastName || meta.last_name || '',
    role: meta.role || 'ADMIN',
    avatar: meta.avatar,
    company: meta.company,
    phone: meta.phone,
    createdAt: su.created_at || new Date().toISOString(),
    updatedAt: su.updated_at || new Date().toISOString(),
  };
};

const applySession = (session: Session | null) => {
  if (session?.user) {
    useAuthStore.setState({
      user: toAppUser(session.user),
      token: session.access_token,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  } else {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      set({ isLoading: false, error: error?.message || 'Login failed' });
      throw new Error(error?.message || 'Invalid email or password');
    }
    applySession(data.session);
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  setUser: (user: User) => {
    set({ user });
  },

  clearError: () => {
    set({ error: null });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    const { data } = await supabase.auth.getSession();
    applySession(data.session);
  },

  updateUser: async (data: Partial<User>) => {
    const current = get().user;
    if (!current) throw new Error('No user logged in');

    set({ isLoading: true, error: null });
    const { data: updated, error } = await supabase.auth.updateUser({
      data: {
        firstName: data.firstName ?? current.firstName,
        lastName: data.lastName ?? current.lastName,
        role: data.role ?? current.role,
        avatar: data.avatar ?? current.avatar,
        company: data.company ?? current.company,
        phone: data.phone ?? current.phone,
      },
    });
    if (error || !updated.user) {
      set({ isLoading: false, error: error?.message || 'Failed to update user' });
      throw new Error(error?.message || 'Failed to update user');
    }
    set({ user: toAppUser(updated.user), isLoading: false });
  },
}));

supabase.auth.onAuthStateChange((_event, session) => {
  applySession(session);
});
