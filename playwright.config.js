// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  globalTimeout: 300_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'webkit-ios',
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],

  webServer: {
    command: `npx --yes serve . --listen ${PORT} --no-clipboard`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
