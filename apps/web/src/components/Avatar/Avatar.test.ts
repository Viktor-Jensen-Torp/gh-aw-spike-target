import { describe, it, expect } from 'vitest';
import { initials } from './Avatar.tsx';

describe('initials', () => {
  it('extracts initials from a two-word name', () => {
    expect(initials('Mara Reyes')).toBe('MR');
  });

  it('extracts initials from a one-word name', () => {
    expect(initials('Mara')).toBe('M');
  });

  it('handles surrounding and repeated spaces', () => {
    expect(initials('  mara   van reyes ')).toBe('MR');
  });

  it('returns empty string for an empty name', () => {
    expect(initials('')).toBe('');
  });

  it('returns empty string for a name with only spaces', () => {
    expect(initials('   ')).toBe('');
  });

  it('uppercases the initials', () => {
    expect(initials('john doe')).toBe('JD');
  });
});
