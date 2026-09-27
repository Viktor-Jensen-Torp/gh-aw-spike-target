import { defineConfig, devices } from '@playwright/test';

// Browser tests run against the real app: the API and the web app, started together.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'list' : 'line',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    cwd: '../..',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    // A fresh database for every run of the suite.
    env: { DATABASE_URL: ':memory:' },
    timeout: 60_000,
    // Show the app's own output, so a server that does not start says why.
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
