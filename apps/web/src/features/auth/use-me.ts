import { useEffect, useState } from 'react';
import { api, ApiClientError } from '../../lib/api-client.ts';
import { MeResponse } from '@tempo/shared/auth';

interface User {
  id: string;
  fullName: string;
  email: string;
}

interface SessionState {
  user: User | null;
  isSignedIn: boolean;
}

type SessionPromise = Promise<SessionState>;

// Module-level promise to cache the session check across all useMe calls
// within the same page load. This ensures only one GET /api/me per page.
let sessionPromise: SessionPromise | null = null;

function fetchSession(): SessionPromise {
  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = (async () => {
    try {
      const response = await api('/me', MeResponse);
      return { user: response.user, isSignedIn: true };
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        return { user: null, isSignedIn: false };
      } else {
        // For other errors, treat as signed out
        return { user: null, isSignedIn: false };
      }
    }
  })();

  return sessionPromise;
}

export function useMe() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const promise = fetchSession();
    promise.then((state) => {
      setUser(state.user);
      setIsSignedIn(state.isSignedIn);
      setIsLoading(false);
    });
  }, []);

  return { user, isLoading, isSignedIn };
}
