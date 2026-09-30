import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Avatar } from './Avatar.tsx';

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  args: {
    name: 'Mara Reyes',
    variant: 'user',
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Initials from a two-word name: "Mara Reyes" → "MR". */
export const InitialsTwoWords: Story = {
  args: {
    name: 'Mara Reyes',
    variant: 'user',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const avatar = page.getByRole('img', { name: 'Mara Reyes' });
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveTextContent('MR');
  },
};

/** Initials from a one-word name: "Mara" → "M". */
export const InitialsOneWord: Story = {
  args: {
    name: 'Mara',
    variant: 'user',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const avatar = page.getByRole('img', { name: 'Mara' });
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveTextContent('M');
  },
};

/** Initials with surrounding and repeated spaces: "  mara   van reyes " → "MR". */
export const InitialsWithSpaces: Story = {
  args: {
    name: '  mara   van reyes ',
    variant: 'user',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    // The aria-label is trimmed, so we query by the trimmed name
    const avatar = page.getByRole('img', { name: 'mara van reyes' });
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveTextContent('MR');
  },
};

/** Empty name renders an empty circle with a fallback accessible name. */
export const EmptyName: Story = {
  args: {
    name: '',
    variant: 'user',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    // Empty name gets a fallback accessible name 'Avatar'
    const avatar = page.getByRole('img', { name: 'Avatar' });
    await expect(avatar).toBeVisible();
    // The span should be empty
    const span = avatar.querySelector('span');
    await expect(span?.textContent).toBe('');
  },
};

/** User variant: 28 px circle, avatar-bg, initials 11 px weight 600 accent. */
export const UserVariant: Story = {
  args: {
    name: 'Mara Reyes',
    variant: 'user',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const avatar = page.getByRole('img', { name: 'Mara Reyes' });
    await expect(avatar).toBeVisible();
    // Check dimensions (28px from design)
    await expect(avatar).toHaveClass('h-7', 'w-7');
    // Check background color
    await expect(avatar).toHaveClass('bg-avatar-bg');
    // Check initials styling
    const span = avatar.querySelector('span');
    await expect(span).toHaveClass('text-accent');
    await expect(span).toHaveClass('text-[11px]');
    await expect(span).toHaveClass('font-semibold');
  },
};

/** Assignee variant: 26 px circle, avatar-neutral, initials 10 px weight 600 text. */
export const AssigneeVariant: Story = {
  args: {
    name: 'Mara Reyes',
    variant: 'assignee',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const avatar = page.getByRole('img', { name: 'Mara Reyes' });
    await expect(avatar).toBeVisible();
    // Check dimensions (26px from design)
    await expect(avatar).toHaveClass('h-[26px]');
    await expect(avatar).toHaveClass('w-[26px]');
    // Check background color
    await expect(avatar).toHaveClass('bg-avatar-neutral');
    // Check initials styling (uses text color for WCAG contrast)
    const span = avatar.querySelector('span');
    await expect(span).toHaveClass('text-text');
    await expect(span).toHaveClass('text-[10px]');
    await expect(span).toHaveClass('font-semibold');
  },
};

/** One-word name in user variant. */
export const UserVariantOneWord: Story = {
  args: {
    name: 'Mara',
    variant: 'user',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const avatar = page.getByRole('img', { name: 'Mara' });
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveTextContent('M');
    await expect(avatar).toHaveClass('bg-avatar-bg');
  },
};

/** One-word name in assignee variant. */
export const AssigneeVariantOneWord: Story = {
  args: {
    name: 'Mara',
    variant: 'assignee',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const avatar = page.getByRole('img', { name: 'Mara' });
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveTextContent('M');
    await expect(avatar).toHaveClass('bg-avatar-neutral');
    // Initials use text color for WCAG contrast
    const span = avatar.querySelector('span');
    await expect(span).toHaveClass('text-text');
  },
};
