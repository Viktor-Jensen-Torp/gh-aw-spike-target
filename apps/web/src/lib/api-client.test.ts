import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiClientError, api } from './api-client.ts';

const Greeting = z.object({ hello: z.string() });

function respondWith(status: number, body: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('returns a response that matches its schema', async () => {
    respondWith(200, JSON.stringify({ hello: 'world' }));
    await expect(api('/greeting', Greeting)).resolves.toEqual({
      hello: 'world',
    });
  });

  it("turns the API's error shape into an ApiClientError with its code and message", async () => {
    respondWith(
      404,
      JSON.stringify({ error: { code: 'not_found', message: 'Not found.' } }),
    );
    await expect(api('/greeting', Greeting)).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'Not found.',
    });
  });

  it('fails a success that is not JSON as an ApiClientError, not a parse error', async () => {
    respondWith(200, '<html>not json</html>');
    const error = await api('/greeting', Greeting).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ code: 'bad_response' });
  });

  it('fails a success that does not match its schema as an ApiClientError', async () => {
    respondWith(200, JSON.stringify({ goodbye: 'world' }));
    await expect(api('/greeting', Greeting)).rejects.toMatchObject({
      code: 'bad_response',
    });
  });
});
