import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run preview -- --port 4173",
      url: "http://localhost:4173",
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: "node scripts/start-cloud-test.mjs",
      url: "http://127.0.0.1:8788",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
