import { defineConfig, devices } from '@playwright/test';

// Set BASE_URL to test a deployed origin. Without it, the tests run against
// `vite preview`, which serves dist/ with the headers of deploy/headers.json.
const remote = process.env.BASE_URL;
const baseURL = remote ?? 'http://localhost:4173';
const ci = process.env.CI !== undefined;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(remote === undefined && {
    webServer: { command: 'npm run preview', url: baseURL, reuseExistingServer: !ci },
  }),
});
