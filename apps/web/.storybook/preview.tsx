import type { Preview } from '@storybook/react-vite';
import '../src/index.css';

const preview: Preview = {
  // An accessibility violation fails the story's test, not only shows in the
  // panel (components.md: never turn this off for a story).
  parameters: { a11y: { test: 'error' } },
  // The same page the app gives a screen (index.html's body).
  decorators: [
    (Story) => (
      <div className="bg-bg p-6 font-sans text-text">
        <Story />
      </div>
    ),
  ],
};

export default preview;
