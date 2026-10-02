import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 120000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173/jpeg-converter-web/', headless: true, acceptDownloads: true },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    ...(process.env.TEST_EDGE ? [{ name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } }] : []),
  ],
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173/jpeg-converter-web/', reuseExistingServer: !process.env.CI },
});
