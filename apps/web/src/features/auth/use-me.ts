import { useEffect, useState } from 'react';
import { api, ApiClientError } from '../../lib/api-client.ts';
import { MeResponse } from '@tempo/shared/auth';

interface User {
  id: string;
  fullName: string;
  email: string;
}

export function useMe() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await api('/me', MeResponse);
        setUser(response.user);
        setIsSignedIn(true);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          setIsSignedIn(false);
        } else {
          // For other errors, treat as signed out
          setIsSignedIn(false);
        }
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkSession();
  }, []);

  return { user, isLoading, isSignedIn };
}
