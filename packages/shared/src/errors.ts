import { z } from 'zod';

/** Every error the API returns has this shape (api.md, "Requests and responses"). */
export const ErrorResponse = z.object({
  error: z.object({
    code: z.string(),
    /** Safe to show to a person. */
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
