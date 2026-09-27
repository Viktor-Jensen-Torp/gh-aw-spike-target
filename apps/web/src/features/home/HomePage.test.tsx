import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage.tsx';

describe('HomePage', () => {
  it("shows the app's name as the page heading", () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'Tempo' })).toBeInTheDocument();
  });
});
