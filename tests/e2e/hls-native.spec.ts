import { test, expect, type Page } from "@playwright/test";
import { SOURCES, lazyFiles, openEmbed, observeStandalone } from "./standalone-helpers";
import { enter, fullscreenTag } from "./overlay-helpers";

// Apple WebKit (Safari desktop, every iOS browser) plays HLS in native <video>.
observeStandalone();
test.beforeEach(({ browserName }) => {
  test.skip(browserName !== "webkit", "only Apple WebKit plays HLS without hls.js");
});

const video = (page: Page) => page.locator("player-stack media-controller > video");

async function playMuted(page: Page) {
  await video(page).evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() => video(page).evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 })
    .toBeGreaterThan(0);
}

test("plays natively and enters fullscreen on <player-stack> with overlays inside", async ({
  page,
}, info) => {
  // iPhone WebKit has no element fullscreen: MP4 behaves the same way there (measured
  // 2026-11-28), so the iPhone project checks playback and overlays only.
  const elementFullscreen = info.project.name !== "ios-chrome";
  const fetched = await openEmbed(page, SOURCES.hls, {
    watermark: { enabled: true, text: "viewer@example.com" },
  });
  await expect(video(page)).toHaveAttribute("src", SOURCES.hls);
  await playMuted(page);
  const watermark = page.locator(".playerstack-watermark");
  await expect(watermark).toBeVisible();
  if (elementFullscreen) {
    await enter(page);
    expect(await fullscreenTag(page)).toBe("PLAYER-STACK");
    await expect(watermark).toBeVisible();
    expect(
      await watermark.evaluate((el) => {
        const doc = document as Document & { webkitFullscreenElement?: Element };
        return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement)?.contains(el);
      }),
    ).toBe(true);
  }
  expect(lazyFiles(fetched).some((f) => f.startsWith("playerstack-hls."))).toBe(false);
});

test("click-to-load thumbnail starts native HLS on click", async ({ page }) => {
  await openEmbed(page, SOURCES.hls, {
    brandedThumb: { enabled: true, clickToLoad: true },
  });
  const thumb = page.locator(".playerstack-thumb-play");
  await expect(thumb).toBeVisible();
  await expect(video(page)).not.toHaveAttribute("src", /.+/);
  await video(page).evaluate((v: HTMLVideoElement) => (v.muted = true));
  await thumb.click();
  await expect(video(page)).toHaveAttribute("src", SOURCES.hls);
  await expect
    .poll(() => video(page).evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 })
    .toBeGreaterThan(0);
});
