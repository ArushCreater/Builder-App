import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor - Add auth token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    // Handle different error scenarios
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const message = (error.response.data as { message?: string })?.message || 'An error occurred';

      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          break;

        case 403:
          // Forbidden - user doesn't have permission
          console.error('Permission denied:', message);
          break;

        case 404:
          // Not found
          console.error('Resource not found:', message);
          break;

        case 422:
          // Validation error
          console.error('Validation error:', message);
          break;

        case 500:
          // Server error
          console.error('Server error:', message);
          break;

        default:
          console.error('API error:', message);
      }

      // Re-throw with enhanced error info
      return Promise.reject({
        status,
        message,
        data: error.response.data,
      });
    } else if (error.request) {
      // Request made but no response received
      console.error('Network error - no response received');
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your connection.',
      });
    } else {
      // Error in request setup
      console.error('Request setup error:', error.message);
      return Promise.reject({
        status: 0,
        message: error.message || 'An unexpected error occurred',
      });
    }
  }
);

export default api;

// Export typed API methods for common operations
export const apiClient = {
  get: <T = any>(url: string, config = {}) =>
    api.get<T>(url, config).then(res => res.data),

  post: <T = any>(url: string, data?: any, config = {}) =>
    api.post<T>(url, data, config).then(res => res.data),

  put: <T = any>(url: string, data?: any, config = {}) =>
    api.put<T>(url, data, config).then(res => res.data),

  patch: <T = any>(url: string, data?: any, config = {}) =>
    api.patch<T>(url, data, config).then(res => res.data),

  delete: <T = any>(url: string, config = {}) =>
    api.delete<T>(url, config).then(res => res.data),
};
