import { defineConfig, devices } from '@playwright/test';

const port = 9001;

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '*.spec.ts',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    baseURL: `https://127.0.0.1:${port}`,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        contextOptions: {
          permissions: ['clipboard-read', 'clipboard-write'],
        },
      },
    },
  ],
  webServer: {
    command: `npx webpack serve --config test/e2e/__dev_server__/webpack.config.cjs --env port=${port}`,
    port,
    timeout: 240 * 1000,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
