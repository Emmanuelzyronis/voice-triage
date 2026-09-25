import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3400',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Dev server is managed externally — run `npm run dev` before tests
  // In CI, set BASE_URL env var and ensure server is started separately
  ...(process.env.CI ? {
    webServer: {
      command: 'npm run dev -- --port 3400',
      url: 'http://localhost:3400',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  } : {}),
})
