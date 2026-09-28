import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { HomePage } from './HomePage.tsx';

/** Answers the page's API call the way `status` says, for one story. */
function answerHealth(status: number) {
  return () => {
    const real = window.fetch;
    window.fetch = async () =>
      status === 200
        ? new Response(JSON.stringify({ status: 'ok' }), { status })
        : new Response('', { status });
    return () => {
      window.fetch = real;
    };
  };
}

const meta = {
  title: 'Screens/Home',
  component: HomePage,
} satisfies Meta<typeof HomePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ApiRunning: Story = {
  beforeEach: answerHealth(200),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await expect(page.getByRole('heading', { name: 'Tempo' })).toBeVisible();
    await expect(await page.findByText('API: ok')).toBeVisible();
  },
};

export const ApiNotAnswering: Story = {
  beforeEach: answerHealth(500),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('API: unavailable'),
    ).toBeVisible();
  },
};
