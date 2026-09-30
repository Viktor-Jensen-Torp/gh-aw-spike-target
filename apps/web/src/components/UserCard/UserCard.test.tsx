import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserCard } from './UserCard.tsx';

describe('UserCard', () => {
  it('Given name "Mara Reyes", plan "Free plan" — Expect a button named "Mara Reyes", showing "MR", "Mara Reyes" and "Free plan"', () => {
    render(<UserCard name="Mara Reyes" plan="Free plan" />);
    const button = screen.getByRole('button', { name: 'Mara Reyes' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('MR');
    expect(button).toHaveTextContent('Mara Reyes');
    expect(button).toHaveTextContent('Free plan');
  });

  it('Given a long name — Expect the card to display it with proper truncation', () => {
    render(
      <UserCard name="Alexandria Victoria Fitzgerald-Smith" plan="Pro plan" />,
    );
    const button = screen.getByRole('button', {
      name: 'Alexandria Victoria Fitzgerald-Smith',
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('AF');
    expect(button).toHaveTextContent('Alexandria Victoria Fitzgerald-Smith');
    expect(button).toHaveTextContent('Pro plan');
  });

  it('Given the card clicked — Expect its click handler to run', async () => {
    const handleClick = vi.fn();
    render(
      <UserCard name="Mara Reyes" plan="Free plan" onClick={handleClick} />,
    );
    const button = screen.getByRole('button', { name: 'Mara Reyes' });
    const user = userEvent.setup();
    await user.click(button);
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
