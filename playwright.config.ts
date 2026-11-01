import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4599" },
  webServer: {
    command: "bun packages/bridge/src/dev-fake.ts",
    url: "http://127.0.0.1:4599",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
