import { test, expect, type Page } from "@playwright/test";
import { SOURCES, openEmbed, observeStandalone } from "./standalone-helpers";

// Click-to-load builds the thumbnail before the provider file arrives (#9 D1).
observeStandalone();

test.describe("click-to-load with a lazily loaded provider", () => {
  const config = { brandedThumb: { enabled: true, clickToLoad: true } };

  /** Holds the provider file until `release()`; plugin files are served at once. */
  function holdProvider(page: Page, src: string) {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let requested!: () => void;
    const request = new Promise<void>((resolve) => (requested = resolve));
    const opened = openEmbed(page, src, config, async (file) => {
      if (/^playerstack-(hls|vimeo)\./.test(file)) {
        requested();
        await held;
      }
      return true;
    });
    return { request, release: () => release(), opened };
  }

  for (const [name, src] of [
    ["HLS", SOURCES.hls],
    ["Vimeo", SOURCES.vimeo],
  ] as const) {
    test(`${name}: the thumbnail shows before the provider file arrives`, async ({
      page,
      browserName,
    }) => {
      // Safari plays HLS natively and loads no provider.
      test.skip(name === "HLS" && browserName === "webkit", "no HLS provider in WebKit");
      await page.route("https://player.vimeo.com/**", (route) =>
        route.fulfill({ contentType: "text/html", body: "<!doctype html><title>stub</title>" }),
      );
      const held = holdProvider(page, src);
      await held.request;
      try {
        await expect(page.locator(".playerstack-thumb-play")).toBeVisible();
        await expect(page.locator("player-stack media-controller")).toBeHidden();
      } finally {
        held.release();
        await held.opened;
      }
      await expect(page.locator("player-stack media-controller")).toBeVisible();
    });
  }

  test("a click before the provider arrives starts playback once it loads", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "no HLS provider in WebKit");
    const held = holdProvider(page, SOURCES.hls);
    await held.request;
    await page.locator(".playerstack-thumb-play").click();
    await expect(page.locator("player-stack hls-video")).toHaveAttribute("src", SOURCES.hls);
    held.release();
    await held.opened;
    await expect
      .poll(
        () =>
          page
            .locator("player-stack hls-video")
            .evaluate((v) => (v as HTMLMediaElement).readyState),
        { timeout: 20_000 },
      )
      .toBeGreaterThanOrEqual(1);
  });
});
