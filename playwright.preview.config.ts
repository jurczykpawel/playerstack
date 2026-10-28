import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "preview-src.spec.ts",
  workers: 2,
  retries: 0,
  reporter: "list",
  outputDir: `${process.env.TMPDIR || "/tmp"}/playerstack-preview-results`,
  use: { trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "chromium-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "webkit-390",
      use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "webkit-1440",
      use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
