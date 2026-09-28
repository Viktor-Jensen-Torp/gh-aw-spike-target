import { useEffect, useState } from 'react';
import { HealthResponse } from '@tempo/shared/health';
import { api } from '../../lib/api-client.ts';

export interface HealthState {
  status: 'loading' | 'ok' | 'unavailable';
}

/** Fetch the API health status. */
export function useHealth(): HealthState {
  const [status, setStatus] = useState<'loading' | 'ok' | 'unavailable'>(
    'loading',
  );

  useEffect(() => {
    api('/health', HealthResponse).then(
      () => setStatus('ok'),
      () => setStatus('unavailable'),
    );
  }, []);

  return { status };
}
