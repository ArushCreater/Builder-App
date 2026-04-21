import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    setUser,
    clearError,
    checkAuth,
    updateUser,
  } = useAuthStore();

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,

    login,
    logout,
    setUser,
    clearError,
    checkAuth,
    updateUser,

    isAdmin: user?.role === 'admin' || user?.role === 'ADMIN',
    isManager: user?.role === 'manager' || user?.role === 'admin' || user?.role === 'ADMIN',
    userName: user ? `${user.firstName} ${user.lastName}`.trim() : '',
  };
};
