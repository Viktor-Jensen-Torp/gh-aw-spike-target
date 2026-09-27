import { describe, expect, it } from 'vitest';
import { ErrorResponse } from './errors.ts';

describe('ErrorResponse', () => {
  it('accepts an error with a code and a message', () => {
    expect(
      ErrorResponse.safeParse({
        error: { code: 'not_found', message: 'Not found.' },
      }).success,
    ).toBe(true);
  });

  it('refuses an error without a message', () => {
    expect(
      ErrorResponse.safeParse({ error: { code: 'not_found' } }).success,
    ).toBe(false);
  });
});
