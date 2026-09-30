import type { RouteObject } from 'react-router';
import { HomePage } from './features/home/HomePage.tsx';
import { SignUpPage } from './features/auth/SignUpPage.tsx';
import { SignInPage } from './features/auth/SignInPage.tsx';
import { ProtectedRoute } from './features/auth/ProtectedRoute.tsx';

/** One entry per screen (web.md, "Components"). */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <HomePage />
      </ProtectedRoute>
    ),
  },
  { path: '/sign-up', element: <SignUpPage /> },
  { path: '/sign-in', element: <SignInPage /> },
];
