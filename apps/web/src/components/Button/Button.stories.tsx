import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Plus, Check, Clock3, Trash2 } from 'lucide-react';
import { Button } from './Button.tsx';

const meta = { title: 'Components/Button', component: Button } satisfies Meta<
  typeof Button
>;

export default meta;
type Story = StoryObj<typeof meta>;

const t =
  (n: string, ...c: string[]) =>
  async (el: HTMLElement) => {
    const btn = within(el).getByRole('button', { name: n });
    c.forEach((x) => expect(btn).toHaveClass(x));
  };

// Primary Block
export const PrimaryBlock: Story = {
  args: { variant: 'primary', size: 'primary-block', children: 'Sign in' },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', { name: 'Sign in' });
    await expect(btn).toBeVisible();
    await t('Sign in', 'w-full', 'bg-accent')(canvasElement);
  },
};

export const PrimaryBlockDisabled: Story = {
  args: {
    variant: 'primary',
    size: 'primary-block',
    children: 'Sign in',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Sign in' }),
    ).toBeDisabled();
  },
};

// Solid Small
export const SolidSmall: Story = {
  args: { variant: 'solid', size: 'solid-small', children: 'Delete task' },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', {
      name: 'Delete task',
    });
    await expect(btn).toBeVisible();
    await t(
      'Delete task',
      'bg-accent',
      'text-on-accent',
      'text-xs',
    )(canvasElement);
  },
};

export const SolidSmallDanger: Story = {
  args: {
    variant: 'solid',
    size: 'solid-small',
    tone: 'danger',
    children: 'Delete task',
  },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', {
      name: 'Delete task',
    });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveClass('bg-danger');
  },
};

export const SolidSmallDisabled: Story = {
  args: {
    variant: 'solid',
    size: 'solid-small',
    children: 'Delete task',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Delete task' }),
    ).toBeDisabled();
  },
};

// Solid Medium
export const SolidMedium: Story = {
  args: { variant: 'solid', size: 'solid-medium', children: 'Save changes' },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', {
      name: 'Save changes',
    });
    await expect(btn).toBeVisible();
    await t(
      'Save changes',
      'bg-accent',
      'text-sm',
      'font-semibold',
    )(canvasElement);
  },
};

export const SolidMediumDanger: Story = {
  args: {
    variant: 'solid',
    size: 'solid-medium',
    tone: 'danger',
    children: 'Delete task',
  },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', {
      name: 'Delete task',
    });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveClass('bg-danger');
  },
};

export const SolidMediumDisabled: Story = {
  args: {
    variant: 'solid',
    size: 'solid-medium',
    children: 'Save changes',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Save changes' }),
    ).toBeDisabled();
  },
};

// Secondary Small
export const SecondarySmall: Story = {
  args: { variant: 'secondary', size: 'secondary-small', children: 'Cancel' },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', { name: 'Cancel' });
    await expect(btn).toBeVisible();
    await t('Cancel', 'border', 'border-border', 'text-muted')(canvasElement);
  },
};

export const SecondarySmallDisabled: Story = {
  args: {
    variant: 'secondary',
    size: 'secondary-small',
    children: 'Cancel',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
  },
};

// Secondary Medium
export const SecondaryMedium: Story = {
  args: { variant: 'secondary', size: 'secondary-medium', children: 'Cancel' },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', { name: 'Cancel' });
    await expect(btn).toBeVisible();
    await t('Cancel', 'bg-surface', 'text-text', 'border')(canvasElement);
  },
};

export const SecondaryMediumDisabled: Story = {
  args: {
    variant: 'secondary',
    size: 'secondary-medium',
    children: 'Cancel',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
  },
};

// With Leading Icon
export const WithLeadingIcon: Story = {
  args: {
    variant: 'solid',
    size: 'with-icon',
    icon: Plus,
    children: 'New task',
  },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', { name: 'New task' });
    await expect(btn).toBeVisible();
    await t('New task', 'w-full', 'bg-accent', 'gap-2')(canvasElement);
    await expect(!!btn.querySelector('svg[aria-hidden="true"]')).toBe(true);
  },
};

export const WithLeadingIconDisabled: Story = {
  args: {
    variant: 'solid',
    size: 'with-icon',
    icon: Plus,
    children: 'New task',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'New task' }),
    ).toBeDisabled();
  },
};

// Solid Icon Compact
export const SolidIconCompact: Story = {
  args: {
    variant: 'solid',
    size: 'solid-icon-compact',
    icon: Check,
    children: 'Mark complete',
  },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', {
      name: 'Mark complete',
    });
    await expect(btn).toBeVisible();
    await t('Mark complete', 'bg-accent', 'gap-2')(canvasElement);
  },
};

export const SolidIconCompactDisabled: Story = {
  args: {
    variant: 'solid',
    size: 'solid-icon-compact',
    icon: Check,
    children: 'Mark complete',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Mark complete' }),
    ).toBeDisabled();
  },
};

// Icon Only Secondary
export const IconOnlySecondary: Story = {
  args: {
    variant: 'icon-secondary',
    size: 'icon-only',
    icon: Clock3,
    'aria-label': 'Snooze',
  },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', { name: 'Snooze' });
    await expect(btn).toBeVisible();
    await t('Snooze', 'border', 'border-border', 'text-muted')(canvasElement);
    await expect(!!btn.querySelector('svg')).toBe(true);
  },
};

export const IconOnlySecondaryDisabled: Story = {
  args: {
    variant: 'icon-secondary',
    size: 'icon-only',
    icon: Clock3,
    'aria-label': 'Snooze',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Snooze' }),
    ).toBeDisabled();
  },
};

// Icon Only Danger
export const IconOnlyDanger: Story = {
  args: {
    variant: 'icon-danger',
    size: 'icon-only',
    icon: Trash2,
    'aria-label': 'Delete task',
  },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole('button', {
      name: 'Delete task',
    });
    await expect(btn).toBeVisible();
    await t(
      'Delete task',
      'border-danger-border',
      'text-danger',
    )(canvasElement);
    await expect(!!btn.querySelector('svg')).toBe(true);
  },
};

export const IconOnlyDangerDisabled: Story = {
  args: {
    variant: 'icon-danger',
    size: 'icon-only',
    icon: Trash2,
    'aria-label': 'Delete task',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Delete task' }),
    ).toBeDisabled();
  },
};

// AsChild: render as a link
export const AsChild: Story = {
  render: () => (
    <Button asChild>
      <a href="/sign-in">Sign in</a>
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Sign in' });
    await expect(link).toBeVisible();
    await expect(link).toHaveClass('bg-accent', 'text-on-accent');
  },
};
