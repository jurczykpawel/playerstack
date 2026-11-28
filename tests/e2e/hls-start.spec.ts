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

test("without config.hls playback starts at the hls.js default level", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "Safari plays HLS natively without hls.js");
  expect(await firstSegmentFolder(page)).toBe("url_0");
});

test("Safari plays HLS natively and never downloads hls.js", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "only Apple WebKit skips hls.js");
  const fetched = await openEmbed(page, SOURCES.hls);
  const video = page.locator("player-stack media-controller > video");
  await expect(video).toHaveAttribute("src", SOURCES.hls);
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).readyState), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(1);
  expect(fetched).toEqual(["playerstack.min.js"]);
  await expect(page.locator("player-stack hls-video")).toHaveCount(0);
});

// config.hls keeps hls.js on Safari too, so these run in both browsers.
for (const hls of [{ abrEwmaDefaultEstimate: 1_200_000 }, { startLevel: 2 }]) {
  test(`starts at 480p with ${JSON.stringify(hls)}`, async ({ page }) => {
    expect(await firstSegmentFolder(page, { hls })).toBe("url_6");
    await expect(page.locator("player-stack hls-video")).toHaveCount(1);
  });
}
