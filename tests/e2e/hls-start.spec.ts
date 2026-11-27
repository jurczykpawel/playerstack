import { test, expect, type Page } from "@playwright/test";
import { SOURCES, openEmbed, observeStandalone } from "./standalone-helpers";

observeStandalone();

// The test stream keeps each quality in its own folder: url_0 is 720p, url_6 is 480p.
async function firstSegmentFolder(page: Page, config?: Record<string, unknown>) {
  const segment = page.waitForRequest((request) => /\/url_\d\/.+\.ts$/.test(request.url()), {
    timeout: 20_000,
  });
  await openEmbed(page, SOURCES.hls, config);
  return (await segment).url().match(/\/(url_\d)\//)![1];
}

test("without config.hls playback starts at the hls.js default level", async ({ page }) => {
  expect(await firstSegmentFolder(page)).toBe("url_0");
});

for (const hls of [{ abrEwmaDefaultEstimate: 1_200_000 }, { startLevel: 2 }]) {
  test(`starts at 480p with ${JSON.stringify(hls)}`, async ({ page }) => {
    expect(await firstSegmentFolder(page, { hls })).toBe("url_6");
  });
}
