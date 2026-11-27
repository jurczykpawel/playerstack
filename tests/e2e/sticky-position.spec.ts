import { test, expect, type Page } from "@playwright/test";
import { SOURCES, openEmbed, observeStandalone } from "./standalone-helpers";

observeStandalone();

async function pin(page: Page, sticky: Record<string, unknown>) {
  await openEmbed(page, SOURCES.mp4, { sticky: { enabled: true, ...sticky } });
  const video = page.locator("player-stack video");
  await expect(video).toHaveAttribute("src", SOURCES.mp4);
  // The helper's inline 640x360 box would override the pinned size.
  await page.locator("player-stack").evaluate((el) => el.removeAttribute("style"));
  await video.evaluate(async (el: HTMLVideoElement) => {
    el.muted = true;
    await el.play();
    document.body.style.minHeight = "300vh";
  });
  await expect(page.locator(".playerstack-sticky-close")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator("player-stack.playerstack-sticky")).toBeVisible();
}

async function gaps(page: Page) {
  return page.locator("player-stack").evaluate((el) => {
    const box = el.getBoundingClientRect();
    const view = document.documentElement;
    return {
      top: Math.round(box.top),
      left: Math.round(box.left),
      right: Math.round(view.clientWidth - box.right),
      bottom: Math.round(view.clientHeight - box.bottom),
    };
  });
}

for (const width of [390, 1440]) {
  for (const position of [undefined, "bottom-right", "bottom-left", "top-right", "top-left"]) {
    test(`pins to ${position ?? "the default corner"} at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await pin(page, position ? { position } : {});
      const [vertical, horizontal] = (position ?? "bottom-right").split("-") as [
        "top" | "bottom",
        "left" | "right",
      ];
      await expect.poll(async () => (await gaps(page))[vertical]).toBe(16);
      expect((await gaps(page))[horizontal]).toBe(16);
      await expect(page.locator(".playerstack-sticky-close")).toBeInViewport({ ratio: 1 });
    });
  }

  test(`honors a custom offset at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await pin(page, { position: "top-left", offset: 72 });
    await expect.poll(async () => (await gaps(page)).top).toBe(72);
    expect((await gaps(page)).left).toBe(72);
    await page.locator(".playerstack-sticky-close").click();
    await expect(page.locator("player-stack.playerstack-sticky")).toHaveCount(0);
  });
}
