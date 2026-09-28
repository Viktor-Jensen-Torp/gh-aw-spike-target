import type { HealthResponse } from '@tempo/shared/health';

/** Returns the health status of the API. */
export function health(): HealthResponse {
  return { status: 'ok' };
}
