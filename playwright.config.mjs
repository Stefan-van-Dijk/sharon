import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/pwa', fullyParallel: false, workers: 1,
  timeout: 60000, expect: { timeout: 15000 },
  use: { browserName: 'chromium', headless: true, serviceWorkers: 'allow' },
  reporter: [['list']],
});
