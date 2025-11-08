import { useAuthStore } from '../stores/authStore';

/**
 * Custom hook for authentication
 * Provides access to auth state and actions
 */
export const useAuth = () => {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    setUser,
    setToken,
    clearError,
    checkAuth,
    updateUser,
  } = useAuthStore();

  return {
    // State
    user,
    token,
    isAuthenticated,
    isLoading,
    error,

    // Actions
    login,
    register,
    logout,
    setUser,
    setToken,
    clearError,
    checkAuth,
    updateUser,

    // Computed values
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager' || user?.role === 'admin',
    userName: user ? `${user.firstName} ${user.lastName}` : '',
  };
};
