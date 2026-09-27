import { describe, expect, it } from 'vitest';
import { ErrorResponse } from '@tempo/shared/errors';
import { testApp } from './lib/test-app.ts';

describe('the API', () => {
  it('answers an unknown route with 404 in the error shape', async () => {
    const app = await testApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/nothing-here',
    });
    expect(response.statusCode).toBe(404);
    expect(ErrorResponse.parse(response.json()).error.code).toBe('not_found');
  });
});
