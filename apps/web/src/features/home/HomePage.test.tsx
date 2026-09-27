import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomePage } from './HomePage.tsx';

describe('HomePage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the app's name as the page heading", () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
      ),
    );
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'Tempo' })).toBeInTheDocument();
  });

  it('shows "API: ok" when the API is running', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
      ),
    );
    render(<HomePage />);
    expect(await screen.findByText('API: ok')).toBeInTheDocument();
  });

  it('shows "API: unavailable" when the API is not answering', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network error');
      }),
    );
    render(<HomePage />);
    expect(await screen.findByText('API: unavailable')).toBeInTheDocument();
  });
});
