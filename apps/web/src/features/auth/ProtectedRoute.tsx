import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useMe } from './use-me.ts';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Wraps a route to require authentication. If the user is not signed in,
 * redirects to /sign-in. While checking, shows nothing (loading).
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isSignedIn, isLoading } = useMe();

  if (isLoading) {
    return null;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}
