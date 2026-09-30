import { z } from 'zod';

/** User account data returned by GET /api/me */
export const Me = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
});
export type Me = z.infer<typeof Me>;

/** Request body for POST /api/sign-up */
export const SignUpRequest = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
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
