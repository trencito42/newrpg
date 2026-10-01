import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 15000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npx next start -p 3100 -H 127.0.0.1",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
