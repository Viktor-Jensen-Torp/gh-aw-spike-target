import type { RouteObject } from 'react-router';
import { HomePage } from './features/home/HomePage.tsx';
import { SignUpPage } from './features/auth/SignUpPage.tsx';
import { SignInPage } from './features/auth/SignInPage.tsx';

/** One entry per screen (web.md, "Components"). */
export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/sign-up', element: <SignUpPage /> },
  { path: '/sign-in', element: <SignInPage /> },
];
