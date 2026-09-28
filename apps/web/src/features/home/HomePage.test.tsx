import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage.tsx';

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    ),
  );
}

function mockApiError() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 500 })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('HomePage', () => {
  it("shows the app's name as the page heading", () => {
    mockApi();
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'Tempo' })).toBeInTheDocument();
  });

  it('shows "API: ok" when the API responds', async () => {
    mockApi();
    render(<HomePage />);
    await expect(screen.findByText('API: ok')).resolves.toBeInTheDocument();
  });

  it('shows "API: unavailable" when the API does not answer', async () => {
    mockApiError();
    render(<HomePage />);
    await expect(
      screen.findByText('API: unavailable'),
    ).resolves.toBeInTheDocument();
  });
});
