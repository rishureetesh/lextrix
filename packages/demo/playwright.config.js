import { defineConfig, devices } from '@playwright/test';

const port = 5173;

export default defineConfig({
  testDir: './test',
  testMatch: '*.spec.js',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5173',
    port,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
