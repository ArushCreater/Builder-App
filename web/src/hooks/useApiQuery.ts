import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

/**
 * Helper hook to handle API responses that may be wrapped in objects
 * Handles both { data: [...] } and [...] response formats
 */
export function useApiQuery<T>(
  queryKey: any[],
  endpoint: string,
  dataKey?: string,
  options?: Omit<UseQueryOptions<any, Error, T>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.get(endpoint);

      // If dataKey is provided and exists in response, extract it
      if (dataKey && response && typeof response === 'object' && dataKey in response) {
        return response[dataKey];
      }

      // Otherwise return the response as-is (could be array or object)
      return response;
    },
    ...options,
  });
}

/**
 * Hook specifically for endpoints that return arrays wrapped in objects
 * Example: { projects: [...] } => [...]
 */
export function useArrayQuery<T>(
  queryKey: any[],
  endpoint: string,
  dataKey: string,
  options?: Omit<UseQueryOptions<T[], Error, T[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T[], Error>({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.get<Record<string, T[]>>(endpoint);

      // Extract array from response object
      if (response && typeof response === 'object' && dataKey in response) {
        const data = response[dataKey];
        return Array.isArray(data) ? data : [];
      }

      // If response is already an array, return it
      if (Array.isArray(response)) {
        return response;
      }

      // Otherwise return empty array
      return [];
    },
    ...options,
  });
}
