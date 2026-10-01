import { useState, useCallback } from 'react';
import { api } from '../../lib/api-client.ts';
import { z } from 'zod';

const SignOutResponse = z.object({});

/**
 * Hook to sign out the current user.
 * Calls POST /api/auth/sign-out to delete the session on the server.
 * On success, redirects to the sign-in screen.
 * On failure, stays on the page and shows an error message.
 */
export function useSignOut() {
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      // Call sign-out endpoint
      await api('/auth/sign-out', SignOutResponse, { method: 'POST' });
      // On success, redirect to sign-in
      window.location.replace('/sign-in');
    } catch {
      // On failure, stay on the page and show error
      setError('Signing out failed. Please try again.');
    }
  }, []);

  return { signOut, error };
}
