import { describe, expect, it } from 'vitest';
import { testApp } from '../../lib/test-app.ts';

describe('GET /api/health', () => {
  it('returns 200, { "status": "ok" }', async () => {
    const app = await testApp();
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
