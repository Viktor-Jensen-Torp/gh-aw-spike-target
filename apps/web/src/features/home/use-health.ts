import { useEffect, useState } from 'react';
import { HealthResponse } from '@tempo/shared/health';
import { ApiClientError, api } from '../../lib/api-client.ts';

type HealthStatus = 'loading' | 'ok' | 'unavailable';

export function useHealth(): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>('loading');

  useEffect(() => {
    let mounted = true;

    async function fetchHealth() {
      try {
        await api('/health', HealthResponse);
        if (mounted) setStatus('ok');
      } catch (error) {
        if (mounted) {
          if (error instanceof ApiClientError) {
            setStatus('unavailable');
          } else {
            setStatus('unavailable');
          }
        }
      }
    }

    void fetchHealth();

    return () => {
      mounted = false;
    };
  }, []);

  return status;
}
