import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: { browserName: 'chromium', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { baseURL: 'http://127.0.0.1:4180/', viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-project-path', use: { baseURL: 'http://127.0.0.1:4180/repository/', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ],
  webServer: { command: 'node scripts/serve-test.mjs', url: 'http://127.0.0.1:4180/', reuseExistingServer: !process.env.CI }
});
