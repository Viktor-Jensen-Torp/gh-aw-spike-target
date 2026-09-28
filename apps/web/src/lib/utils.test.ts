import { describe, expect, it } from 'vitest';
import { cn } from './utils.ts';

describe('cn', () => {
  it('joins class names and drops falsy ones', () => {
    expect(cn('px-2', false, undefined, 'text-text')).toBe('px-2 text-text');
  });

  it("lets a later Tailwind class win over an earlier one, so a caller's className overrides a default", () => {
    expect(cn('px-2 bg-accent', 'px-4')).toBe('bg-accent px-4');
  });
});
