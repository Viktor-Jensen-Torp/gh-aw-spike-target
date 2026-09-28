import type { StorybookConfig } from '@storybook/react-vite';

// Stories live next to their component (components.md). The Vitest addon runs
// each one as a test in a real browser, inside `npm test`; the a11y addon
// checks each one (preview.tsx makes a violation fail).
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-vitest', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  // No usage reports: agents run behind a firewall that would block them.
  core: { disableTelemetry: true },
};

export default config;
