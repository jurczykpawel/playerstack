import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "playback-preferences.spec.ts",
  workers: 2,
  retries: 0,
  reporter: "list",
  outputDir: `${process.env.TMPDIR || "/tmp"}/playerstack-preferences-results`,
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
