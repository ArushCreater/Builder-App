import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

interface Contact {
  id: string;
  name: string;
  email?: string;
}

/**
 * Returns the first contact email that starts with `input` (case-insensitive)
 * and isn't an exact match for it. Returns null when there's nothing to suggest.
 *
 * Backed by GET /api/contacts?search=… which already does substring matching
 * across name/email/company — we filter to startsWith on email client-side.
 */
export function useContactEmailSuggestion(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  const enabled = trimmed.length >= 2;

  const { data } = useQuery({
    queryKey: ['contact-email-suggest', trimmed],
    queryFn: () =>
      apiClient.get<{ contacts: Contact[] }>(`/contacts?search=${encodeURIComponent(trimmed)}`),
    enabled,
    staleTime: 30_000,
  });

  return useMemo(() => {
    if (!enabled || !data?.contacts) return null;
    const match = data.contacts.find((c) => {
      const e = (c.email || '').toLowerCase();
      return e && e.startsWith(trimmed) && e !== trimmed;
    });
    return match?.email || null;
  }, [data, trimmed, enabled]);
}
