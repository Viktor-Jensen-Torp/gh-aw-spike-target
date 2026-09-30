import { useCallback } from 'react';
import { api } from '../../lib/api-client.ts';
import { z } from 'zod';

const SignOutResponse = z.object({});

/**
 * Hook to sign out the current user.
 * Calls POST /api/auth/sign-out to delete the session on the server,
 * then reloads the page to redirect to the sign-in screen.
 */
export function useSignOut() {
  const signOut = useCallback(async () => {
    try {
      // Call sign-out endpoint
      await api('/auth/sign-out', SignOutResponse, { method: 'POST' });
    } catch (error) {
      // Even if the API call fails, redirect to sign-in
      // (session might already be invalid)
      console.error('Sign out error:', error);
    } finally {
      // Replace the current history entry with sign-in page to prevent
      // going back to the signed-in page
      window.location.replace('/sign-in');
    }
  }, []);

  return { signOut };
}
