import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "../tests",
  testMatch: "quantities.spec.ts",
  workers: 1,
  timeout: 60000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4182",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4182 --strictPort",
    url: "http://127.0.0.1:4182",
    reuseExistingServer: false,
  },
});
