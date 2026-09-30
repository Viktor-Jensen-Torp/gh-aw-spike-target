import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { UserCard } from './UserCard.tsx';

const meta = {
  title: 'Components/UserCard',
  component: UserCard,
  args: {
    name: 'Mara Reyes',
    plan: 'Free plan',
  },
} satisfies Meta<typeof UserCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Given name "Mara Reyes", plan "Free plan" — Expect a button named "Mara Reyes", showing "MR", "Mara Reyes" and "Free plan". */
export const ManagedByFreePlan: Story = {
  args: {
    name: 'Mara Reyes',
    plan: 'Free plan',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    // The button should have aria-label (accessible name) "Mara Reyes"
    const button = page.getByRole('button', { name: 'Mara Reyes' });
    await expect(button).toBeVisible();
    // Should show "MR" (avatar initials)
    const avatar = within(button).getByRole('img', { name: 'Mara Reyes' });
    await expect(avatar).toHaveTextContent('MR');
    // Should show "Mara Reyes" (name)
    await expect(button).toHaveTextContent('Mara Reyes');
    // Should show "Free plan"
    await expect(button).toHaveTextContent('Free plan');
  },
};

/** Given a long name — Expect the name and plan to fit within the card with truncation if needed. */
export const LongName: Story = {
  args: {
    name: 'Alexandria Victoria Fitzgerald-Smith',
    plan: 'Pro plan',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    // The button should have aria-label (accessible name) with the full long name
    const button = page.getByRole('button', {
      name: 'Alexandria Victoria Fitzgerald-Smith',
    });
    await expect(button).toBeVisible();
    // Should show the avatar
    const avatar = within(button).getByRole('img', {
      name: 'Alexandria Victoria Fitzgerald-Smith',
    });
    await expect(avatar).toHaveTextContent('AF');
    // Should show the full name and plan text (truncation is handled by CSS)
    await expect(button).toHaveTextContent(
      'Alexandria Victoria Fitzgerald-Smith',
    );
    await expect(button).toHaveTextContent('Pro plan');
  },
};

/** The card is a button; when clicked, its click handler runs. */
export const ClickHandler: Story = {
  args: {
    name: 'Mara Reyes',
    plan: 'Free plan',
    onClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement);
    const button = page.getByRole('button', { name: 'Mara Reyes' });
    // Verify the button is visible and enabled
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    // Click the button
    await button.click();
    // Verify the click handler was called
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
