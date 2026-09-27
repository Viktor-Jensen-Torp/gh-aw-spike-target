import type { RouteObject } from 'react-router';
import { HomePage } from './features/home/HomePage.tsx';

/** One entry per screen (web.md, "Components"). */
export const routes: RouteObject[] = [{ path: '/', element: <HomePage /> }];
