import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { supabase } from './supabase';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
let handlingUnauthorized = false;

function resolveApiBaseUrl() {
  const raw = ((import.meta as any)?.env?.VITE_API_URL as string | undefined)?.trim();
  const allowCrossOriginApi = ((import.meta as any)?.env?.VITE_ALLOW_CROSS_ORIGIN_API as string | undefined) === 'true';
  if (!raw) return '/api';
  if (typeof window === 'undefined') return raw;

  try {
    const currentUrl = new URL(window.location.origin);
    const candidateUrl = new URL(raw, window.location.origin);
    const isLocalPage = LOCAL_HOSTS.has(currentUrl.hostname);
    const isLocalTarget = LOCAL_HOSTS.has(candidateUrl.hostname);
    const isCrossOrigin = candidateUrl.origin !== currentUrl.origin;
    const isInsecureFromSecurePage = currentUrl.protocol === 'https:' && candidateUrl.protocol === 'http:';
    const isDeprecatedAwsTarget =
      candidateUrl.hostname.includes('elb.amazonaws.com') || candidateUrl.hostname.startsWith('awseb-');

    if (!isLocalPage && (isLocalTarget || isInsecureFromSecurePage || isDeprecatedAwsTarget)) {
      console.warn(`Ignoring unsafe VITE_API_URL "${raw}" in production and falling back to /api`);
      return '/api';
    }

    if (!isLocalPage && isCrossOrigin && !allowCrossOriginApi) {
      console.warn(`Ignoring cross-origin VITE_API_URL "${candidateUrl.origin}" in production and falling back to /api`);
      return '/api';
    }

    if (!isLocalPage && isCrossOrigin) {
      console.warn(`Using cross-origin API base URL "${candidateUrl.origin}" in production because VITE_ALLOW_CROSS_ORIGIN_API=true`);
    }

    return raw;
  } catch {
    return raw;
  }
}

const apiBaseURL = resolveApiBaseUrl();

const api: AxiosInstance = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

function getRequestUrl(config?: InternalAxiosRequestConfig | any) {
  if (!config) return apiBaseURL || window.location.origin;
  try {
    const uri = api.getUri(config);
    return /^https?:\/\//i.test(uri) ? uri : new URL(uri, window.location.origin).toString();
  } catch {
    const requestPath = config?.url || '';
    const baseUrl = config?.baseURL || apiBaseURL || window.location.origin;
    const normalizedBaseUrl = /^https?:\/\//i.test(baseUrl)
      ? baseUrl
      : new URL(baseUrl, window.location.origin).toString();
    return requestPath
      ? new URL(requestPath, normalizedBaseUrl).toString()
      : normalizedBaseUrl;
  }
}

async function handleUnauthorized() {
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;

  try {
    // Clear the local session without making an extra logout network call.
    await supabase.auth.signOut({ scope: 'local' });
  } catch (signOutError) {
    console.error('Local sign-out failed:', signOutError);
  } finally {
    window.setTimeout(() => {
      handlingUnauthorized = false;
    }, 0);
  }
}

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
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
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const message = (error.response.data as { message?: string })?.message || 'An error occurred';

      switch (status) {
        case 401:
          handleUnauthorized();
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
        requestUrl: getRequestUrl(error.config),
      });
    } else if (error.request) {
      // Request made but no response received
      const requestUrl = getRequestUrl(error.config);
      console.error('Network error - no response received', { requestUrl });
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your connection.',
        requestUrl,
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
