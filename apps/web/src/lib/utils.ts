import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Joins class names, letting a later Tailwind class win over an earlier one,
 * so a caller's `className` overrides a component's defaults (components.md).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
