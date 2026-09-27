import type { z } from 'zod';
import { ErrorResponse } from '@tempo/shared/errors';

/** A failed API call, with the API's own code and a message safe to show. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * The only place the web app calls the API (web.md, "Data comes through one
 * client"). Every response is parsed with its schema from @tempo/shared.
 */
export async function api<T extends z.ZodType>(
  path: string,
  schema: T,
  init: RequestInit = {},
): Promise<z.infer<T>> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
    credentials: 'same-origin',
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ErrorResponse.safeParse(body);
    throw parsed.success
      ? new ApiClientError(
          response.status,
          parsed.data.error.code,
          parsed.data.error.message,
        )
      : new ApiClientError(response.status, 'unknown', 'Something went wrong.');
  }
  return schema.parse(body);
}
