import { z } from 'zod';

/** User account data returned by GET /api/me */
export const Me = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
});
export type Me = z.infer<typeof Me>;

/**
 * Password validation rule: at least 8 characters and a number or symbol.
 * Used by both the form and the API.
 */
function validatePassword(password: string): boolean {
  if (password.length < 8) return false;
  // Check for at least one digit or symbol
  const symbolPattern = new RegExp(
    '[0-9!@#$%^&*()_+\\-=\\[\\]{};:\'",.<?>/\\\\|`~]',
  );
  return symbolPattern.test(password);
}

/** Request body for POST /api/auth/sign-up */
export const SignUpRequest = z.object({
  fullName: z.string().trim().min(1, 'Full name is required'),
  email: z.string().trim().toLowerCase().email('Email must be a valid address'),
  password: z
    .string()
    .min(
      8,
      'Password is too weak. Use at least 8 characters and add a number or symbol.',
    )
    .refine(
      validatePassword,
      'Password is too weak. Use at least 8 characters and add a number or symbol.',
    ),
});
export type SignUpRequest = z.infer<typeof SignUpRequest>;

/** Response from POST /api/sign-up */
export const SignUpResponse = z.object({
  user: Me,
});
export type SignUpResponse = z.infer<typeof SignUpResponse>;

/** Request body for POST /api/sign-in */
export const SignInRequest = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type SignInRequest = z.infer<typeof SignInRequest>;

/** Response from POST /api/sign-in */
export const SignInResponse = z.object({
  user: Me,
});
export type SignInResponse = z.infer<typeof SignInResponse>;

/** Response from GET /api/me */
export const MeResponse = z.object({
  user: Me,
});
export type MeResponse = z.infer<typeof MeResponse>;
