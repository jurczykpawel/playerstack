import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["hls-start.spec.ts", "hls-native.spec.ts", "click-to-load.spec.ts"],
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: `${process.env.TMPDIR || "/tmp"}/playerstack-hls-results`,
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    // Chrome on iOS is WebKit with navigator.vendor "Apple Computer, Inc.".
    {
      name: "ios-chrome",
      use: {
        ...devices["iPhone 13"],
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
      },
    },
  ],
});
