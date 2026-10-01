import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { TextField } from './TextField.tsx';

const meta = {
  title: 'Components/TextField',
  component: TextField,
  args: {
    label: 'Email',
  },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An empty text input field with just a label. */
export const Empty: Story = {
  args: {
    label: 'Email',
    placeholder: 'you@company.com',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const input = page.getByRole('textbox', { name: 'Email' });
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'text');
    // aria-invalid should not be set when there's no error
    const ariaInvalid = input.getAttribute('aria-invalid');
    await expect(ariaInvalid).toBeNull();
  },
};

/** A text input field with a value filled in. */
export const Filled: Story = {
  args: {
    label: 'Email',
    value: 'you@company.com',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const input = page.getByRole('textbox', { name: 'Email' });
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('you@company.com');
  },
};

/** A text input field with a hint text below. */
export const WithHint: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter password',
    hint: 'At least 8 characters, with a number or symbol.',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    // Password input can be found via querySelector
    const input = canvasElement.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await expect(input).toBeVisible();
    // Hint should be visible
    const hint = page.getByText(
      'At least 8 characters, with a number or symbol.',
    );
    await expect(hint).toBeVisible();
  },
};

/** A password field with show/hide toggle. When "Show password" is clicked, value is visible and button is named "Hide password". */
export const Password: Story = {
  args: {
    label: 'Password',
    type: 'password',
    value: 'secret123',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const input = canvasElement.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'password');

    // Initially, the toggle button should be named "Show password"
    const toggleButton = page.getByRole('button', {
      name: 'Show password',
    });
    await expect(toggleButton).toBeVisible();

    // Click to show password
    await userEvent.click(toggleButton);

    // The input type should now be text (value visible)
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).toHaveValue('secret123');

    // The button should now be named "Hide password"
    const hideButton = page.getByRole('button', {
      name: 'Hide password',
    });
    await expect(hideButton).toBeVisible();

    // Click to hide password again
    await userEvent.click(hideButton);

    // Input type should be password again
    await expect(input).toHaveAttribute('type', 'password');
    const showButton = page.getByRole('button', {
      name: 'Show password',
    });
    await expect(showButton).toBeVisible();
  },
};

/** A text input field with a link in the label row (e.g., "Forgot password?"). */
export const WithLabelLink: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter password',
    link: {
      label: 'Forgot password?',
      href: '/forgot',
    },
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const input = canvasElement.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await expect(input).toBeVisible();

    // Link should be visible and named "Forgot password?"
    const link = page.getByRole('link', { name: 'Forgot password?' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/forgot');
  },
};

/** A text input field with an error message shown below. The input is invalid and described by the error text. No icon inside the field. */
export const WithError: Story = {
  args: {
    label: 'Email',
    value: 'mara@reyes.studio',
    error:
      'This email is already in use. Sign in instead or reset your password.',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const input = page.getByRole('textbox', { name: 'Email' });
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    // Error message should be visible
    const error = page.getByText(
      'This email is already in use. Sign in instead or reset your password.',
    );
    await expect(error).toBeVisible();

    // Input should be described by the error text
    const describedBy = input.getAttribute('aria-describedby');
    await expect(describedBy).toBeTruthy();
    if (describedBy) {
      const errorId = describedBy.split(' ')[0];
      if (errorId) {
        const errorElement = document.getElementById(errorId) as HTMLElement;
        await expect(errorElement).toHaveTextContent(
          'This email is already in use. Sign in instead or reset your password.',
        );
      }
    }

    // Error icon should appear only below the input in the error row, not inside the field
    // The input row should not contain any trailing icon
    const inputRow = input.closest('div[class*="h-\\["]');
    const trailingButton = inputRow?.querySelector('button');
    await expect(!trailingButton).toBe(true);
  },
};

/** A password field with both a hint and an error. Only the error should show. */
export const WithHintAndError: Story = {
  args: {
    label: 'Password',
    type: 'password',
    value: 'short',
    hint: 'At least 8 characters, with a number or symbol.',
    error: 'Password is too short.',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const input = canvasElement.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await expect(input).toBeVisible();

    // Error should be visible
    const error = page.getByText('Password is too short.');
    await expect(error).toBeVisible();

    // Hint should NOT be visible
    const hintElements = canvasElement.querySelectorAll('p');
    let hintFound = false;
    for (const el of hintElements) {
      if (
        el.textContent?.includes(
          'At least 8 characters, with a number or symbol.',
        )
      ) {
        hintFound = true;
        break;
      }
    }
    await expect(!hintFound).toBe(true);
  },
};

/** A password field with an error message. The input is invalid, with error shown below. The eye icon remains visible and the same colour as without error. */
export const PasswordWithError: Story = {
  args: {
    label: 'Password',
    type: 'password',
    value: 'incorrect',
    error: 'Email or password is incorrect.',
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const input = canvasElement.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'password');
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    // Error message should be visible
    const error = page.getByText('Email or password is incorrect.');
    await expect(error).toBeVisible();

    // The password toggle (eye icon) should still be available and same colour as without error
    const passwordToggle = page.getByRole('button', {
      name: 'Show password',
    });
    await expect(passwordToggle).toBeVisible();
    // Icon should have text-faint class (same colour as without error)
    await expect(passwordToggle).toHaveClass('text-faint');
  },
};

/** A text input field marked as invalid without showing an error message. */
export const InvalidWithoutError: Story = {
  args: {
    label: 'Email',
    value: 'mara@reyes.studio',
    invalidWithoutError: true,
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    const input = page.getByRole('textbox', { name: 'Email' });
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    // Error message should NOT be visible
    const errorElements = canvasElement.querySelectorAll('[id*="error"]');
    let errorFound = false;
    for (const el of errorElements) {
      if (el.textContent?.length) {
        errorFound = true;
        break;
      }
    }
    await expect(!errorFound).toBe(true);
  },
};
