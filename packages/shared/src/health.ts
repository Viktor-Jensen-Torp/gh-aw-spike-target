import { z } from 'zod';

/** The API's health status response (issue #83). */
export const HealthResponse = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
