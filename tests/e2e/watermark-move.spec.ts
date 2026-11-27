import { test, expect, type Page } from "@playwright/test";
import { enter, fullscreenTag, open } from "./overlay-helpers";

const watermark = {
  enabled: true,
  text: "jan.kowalski.with.a.long.address@students.example.com",
  href: "https://example.com/brand",
  moveInterval: 10,
};
// Both extremes of the random range, then the middle.
const spots = [
  [0.999999, 0.999999],
  [0, 0],
  [0.999999, 0],
  [0, 0.999999],
  [0.5, 0.5],
] as const;

const pin = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      let call = 0;
      Math.random = () => (call++ % 2 ? y! : x!);
    },
    [x, y],
  );

/** Distances from the watermark to the frame edges and to the control bar. */
const gaps = (page: Page) =>
  page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const frame = rect("player-stack");
    const mark = rect(".playerstack-watermark");
    return {
      left: Math.round(mark.left - frame.left),
      top: Math.round(mark.top - frame.top),
      right: Math.round(frame.right - mark.right),
      aboveBar: Math.round(rect("media-control-bar").top - mark.bottom),
    };
  });

async function visitSpots(page: Page) {
  for (const [x, y] of spots) {
    await pin(page, x, y);
    await page.clock.runFor(10_000);
    await expect
      .poll(async () => Object.values(await gaps(page)).every((gap) => gap >= 0))
      .toBe(true);
    const seen = await gaps(page);
    if (x === 0) expect(seen.left).toBe(16);
    if (x > 0.99) expect(seen.right).toBe(16);
    if (y === 0) expect(seen.top).toBe(16);
    if (y > 0.99) expect(seen.aboveBar).toBeLessThanOrEqual(8);
    for (const control of ["media-play-button", "media-fullscreen-button"]) {
      await page.locator(control).click({ trial: true, timeout: 5000 });
    }
  }
}

for (const width of [390, 1440]) {
  test.describe(`moving watermark ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("moves only when its interval passes", async ({ page }) => {
      await page.clock.install({ time: 0 });
      await open(page, { watermark: { ...watermark, moveTransition: "jump" } });
      await page.clock.pauseAt(60_000);
      const mark = page.locator(".playerstack-watermark");
      await pin(page, 0, 0);
      await page.clock.runFor(10_000);
      await expect.poll(async () => (await gaps(page)).left).toBe(16);
      const before = await mark.boundingBox();
      await pin(page, 0.999999, 0.999999);
      await page.clock.runFor(9_000);
      expect(await mark.boundingBox()).toEqual(before);
      await page.clock.runFor(1_000);
      await expect.poll(async () => (await gaps(page)).right).toBe(16);
      expect((await mark.boundingBox())!.y).toBeGreaterThan(before!.y);
    });

    test("stays inside the frame and above the controls, inline and fullscreen", async ({
      page,
    }) => {
      await page.clock.install();
      await open(page, { watermark: { ...watermark, moveTransition: "jump" } });
      await visitSpots(page);
      await enter(page);
      expect(await fullscreenTag(page)).toBe("PLAYER-STACK");
      await expect(page.locator(".playerstack-watermark")).toBeVisible();
      await visitSpots(page);
      expect(
        await page
          .locator(".playerstack-watermark")
          .evaluate((el) => !!document.fullscreenElement?.contains(el)),
      ).toBe(true);
    });
  });
}

for (const [reducedMotion, duration] of [
  ["no-preference", "0.8s"],
  ["reduce", "0s"],
] as const) {
  test(`transition with reduced motion ${reducedMotion} lasts ${duration}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.clock.install();
    await open(page, { watermark });
    await page.clock.runFor(10_000);
    await expect
      .poll(() =>
        page
          .locator(".playerstack-watermark")
          .evaluate((el) => getComputedStyle(el).transitionDuration.split(",")[0]),
      )
      .toBe(duration);
  });
}

test("a removed watermark returns when reinsert is on", async ({ page }) => {
  await open(page, { watermark: { ...watermark, reinsert: true } });
  const mark = page.locator(".playerstack-watermark");
  await mark.evaluate((el) => el.remove());
  await expect(mark).toBeVisible();
});
