import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["sticky-position.spec.ts", "sticky-mobile.spec.ts"],
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: `${process.env.TMPDIR || "/tmp"}/playerstack-sticky-results`,
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
