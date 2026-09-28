import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from './Button.tsx';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: 'Sign in',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A plain button with just a label. */
export const PlainButton: Story = {
  args: {
    children: 'Sign in',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const button = page.getByRole('button', { name: 'Sign in' });
    await expect(button).toBeVisible();
    await expect(button).toHaveClass('bg-accent');
    await expect(button).toHaveClass('text-white');
  },
};

/** A button with a leading icon. The icon is decorative, so the button's name is just the label. */
export const WithIcon: Story = {
  args: {
    children: 'New task',
    icon: 'Plus',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const button = page.getByRole('button', { name: 'New task' });
    await expect(button).toBeVisible();
    // Icon should be present and hidden from accessible name
    const icon = button.querySelector('svg');
    // The icon should exist
    await expect(!!icon).toBe(true);
  },
};

/** A submit button inside a form. When clicked, the form's submit handler runs once. */
export const SubmitInForm: Story = {
  render: () => {
    let submitCount = 0;
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      submitCount++;
      (e.target as HTMLFormElement).dataset.submitCount = String(submitCount);
    };

    return (
      <form onSubmit={handleSubmit} data-submit-count="0">
        <input
          type="text"
          placeholder="Enter something"
          aria-label="Test input"
        />
        <Button type="submit">Submit</Button>
      </form>
    );
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const form = canvasElement.querySelector('form');
    const button = page.getByRole('button', { name: 'Submit' });

    // Initial state
    await expect(form?.dataset.submitCount).toBe('0');

    // Click the button
    await userEvent.click(button);

    // Form submit handler should have run once
    await expect(form?.dataset.submitCount).toBe('1');
  },
};
