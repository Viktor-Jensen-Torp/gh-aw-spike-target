import { z } from 'zod';

/** The response from GET /api/health. */
export const HealthResponse = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
