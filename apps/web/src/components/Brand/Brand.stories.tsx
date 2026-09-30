import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Brand } from './Brand.tsx';

const meta = {
  title: 'Components/Brand',
  component: Brand,
} satisfies Meta<typeof Brand>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The brand mark alone: a 28x28 square with radius 8, accent fill, and a check icon.
 * The accessible name is "Tempo".
 * The check icon is decorative and hidden from assistive tech.
 */
export const MarkOnly: Story = {
  args: {
    withName: false,
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    // The mark should be accessible by the name "Tempo"
    const mark = page.getByRole('img', { name: 'Tempo' });
    await expect(mark).toBeVisible();
    // The mark element should have inline-flex layout
    await expect(mark).toHaveClass('inline-flex', 'items-center');
    // Check icon should be hidden from assistive tech
    const checkIcon = mark.querySelector('svg');
    await expect(checkIcon).toHaveAttribute('aria-hidden', 'true');
  },
};

/**
 * The brand with its name in auth layout: mark, gap 10, then "Tempo" text.
 * The text is 17 px weight 600 in the text color.
 * The accessible name is "Tempo".
 * The check icon is hidden from assistive tech.
 */
export const AuthBrand: Story = {
  args: {
    withName: true,
    variant: 'auth',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    // The brand should be accessible by the name "Tempo"
    const brand = page.getByRole('img', { name: 'Tempo' });
    await expect(brand).toBeVisible();
    // The text "Tempo" should be in the DOM but hidden from screen readers
    const tempoText = within(brand).getByText('Tempo');
    await expect(tempoText).toBeVisible();
    // The text should have aria-hidden since the accessible name comes from aria-label
    await expect(tempoText).toHaveAttribute('aria-hidden', 'true');
    // The text should have the right styling
    await expect(tempoText).toHaveClass(
      'text-base',
      'font-semibold',
      'text-text',
    );
    // Check icon should be hidden from assistive tech
    const checkIcon = brand.querySelector('svg');
    await expect(checkIcon).toHaveAttribute('aria-hidden', 'true');
    // Container should have the right layout
    await expect(brand).toHaveClass('flex', 'items-center', 'gap-2.5');
  },
};

/**
 * The brand with its name in sidebar layout: full width with padding 4.
 * Mark, gap 10, then "Tempo" text. The accessible name is "Tempo".
 * The check icon is hidden from assistive tech.
 */
export const SidebarBrand: Story = {
  args: {
    withName: true,
    variant: 'sidebar',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    // The brand should be accessible by the name "Tempo"
    const brand = page.getByRole('img', { name: 'Tempo' });
    await expect(brand).toBeVisible();
    // The text "Tempo" should be in the DOM but hidden from screen readers
    const tempoText = within(brand).getByText('Tempo');
    await expect(tempoText).toBeVisible();
    // The text should have aria-hidden since the accessible name comes from aria-label
    await expect(tempoText).toHaveAttribute('aria-hidden', 'true');
    // The text should have the right styling
    await expect(tempoText).toHaveClass(
      'text-base',
      'font-semibold',
      'text-text',
    );
    // Container should have full width and padding for sidebar layout
    await expect(brand).toHaveClass('w-full', 'px-1', 'py-1', 'gap-2.5');
    // Check icon should be hidden from assistive tech
    const checkIcon = brand.querySelector('svg');
    await expect(checkIcon).toHaveAttribute('aria-hidden', 'true');
  },
};
