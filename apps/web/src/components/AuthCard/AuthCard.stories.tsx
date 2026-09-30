import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within, userEvent } from 'storybook/test';
import { vi } from 'vitest';
import { AuthCard } from './AuthCard.tsx';
import { TextField } from '../TextField/TextField.tsx';

const meta = {
  title: 'Components/AuthCard',
  component: AuthCard,
} satisfies Meta<typeof AuthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sign-in card
export const SignIn: Story = {
  args: {
    heading: 'Welcome back',
    subheading: 'Sign in to pick up where you left off.',
    submitLabel: 'Sign in',
    footerText: "Don't have an account?",
    footerLinkText: 'Create one',
    footerLinkHref: '/signup',
    children: (
      <>
        <TextField label="Email" type="email" placeholder="you@company.com" />
        <TextField label="Password" type="password" />
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    // Verify the heading exists
    const heading = within(canvasElement).getByRole('heading', {
      name: 'Welcome back',
    });
    await expect(heading).toBeVisible();

    // Verify the submit button is rendered
    const button = within(canvasElement).getByRole('button', {
      name: 'Sign in',
    });
    await expect(button).toBeVisible();
  },
};

export const HeadingWelcomeBack: Story = {
  args: {
    heading: 'Welcome back',
    subheading: 'Sign in to pick up where you left off.',
    submitLabel: 'Sign in',
    footerText: "Don't have an account?",
    footerLinkText: 'Create one',
    footerLinkHref: '/signup',
    children: (
      <>
        <TextField label="Email" type="email" placeholder="you@company.com" />
        <TextField label="Password" type="password" />
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole('heading', {
      name: 'Welcome back',
    });
    await expect(heading).toBeVisible();
  },
};

export const FooterWithLink: Story = {
  args: {
    heading: 'Welcome back',
    subheading: 'Sign in to pick up where you left off.',
    submitLabel: 'Sign in',
    footerText: "Don't have an account?",
    footerLinkText: 'Create one',
    footerLinkHref: '/signup',
    children: (
      <>
        <TextField label="Email" type="email" placeholder="you@company.com" />
        <TextField label="Password" type="password" />
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    // Check footer text is visible
    const footerText = page.getByText("Don't have an account?");
    await expect(footerText).toBeVisible();
    // Check link is visible
    const link = page.getByRole('link', {
      name: 'Create one',
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/signup');
  },
};

export const FormSubmitHandler: Story = {
  args: {
    heading: 'Welcome back',
    subheading: 'Sign in to pick up where you left off.',
    submitLabel: 'Sign in',
    footerText: "Don't have an account?",
    footerLinkText: 'Create one',
    footerLinkHref: '/signup',
    onSubmit: vi.fn((e) => {
      e.preventDefault();
    }),
    children: (
      <>
        <TextField label="Email" type="email" placeholder="you@company.com" />
        <TextField label="Password" type="password" />
      </>
    ),
  },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Sign in',
    });
    await expect(button).toBeVisible();
    await userEvent.click(button);
    // Verify the onSubmit handler was called
    await expect(args.onSubmit).toHaveBeenCalledOnce();
  },
};

// Sign-up card
export const SignUp: Story = {
  args: {
    heading: 'Create your account',
    subheading: 'Get started with Tempo today.',
    submitLabel: 'Sign up',
    footerText: 'Already have an account?',
    footerLinkText: 'Sign in',
    footerLinkHref: '/signin',
    children: (
      <>
        <TextField label="Email" type="email" placeholder="you@company.com" />
        <TextField label="Password" type="password" />
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole('heading', {
      name: 'Create your account',
    });
    await expect(heading).toBeVisible();

    const link = within(canvasElement).getByRole('link', { name: 'Sign in' });
    await expect(link).toBeVisible();
  },
};
