import { defineConfig, devices } from '@playwright/test';

const toastMaxVisible = process.env.PW_TOAST_MAX_VISIBLE ?? '1';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      VITE_FEATURE_NOTIFICATIONS: 'true',
      VITE_FEATURE_NOTIFICATIONS_TOASTS: 'true',
      VITE_FEATURE_NOTIFICATIONS_MOCK: 'true',
      VITE_NOTIFICATIONS_TOAST_MAX_VISIBLE: toastMaxVisible,
      VITE_NOTIFICATIONS_TOAST_TTL_SECONDS: '60',
      VITE_PWA_DEV_SW: 'false',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
