import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const origin = "http://127.0.0.1:15184";
const dist = process.env.PLAYERSTACK_DIST || resolve("packages/embed/dist");
const mp4 = readFileSync(resolve("apps/docs/public/demo.mp4"));
async function open(page: Page, intro = false) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) throw new Error(`Unexpected external request: ${url}`);
    if (url.pathname === "/demo.mp4") return route.fulfill({ body: mp4, contentType: "video/mp4" });
    if (url.pathname.startsWith("/assets/"))
      return route.fulfill({
        body: readFileSync(resolve(dist, url.pathname.split("/").pop()!)),
        contentType: "application/javascript",
      });
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><style>body{margin:16px}player-stack{display:block;width:min(100%,720px);aspect-ratio:16/9}</style><button id="before">Before</button><player-stack src="${origin}/demo.mp4" data-config='${JSON.stringify({ preload: "none", brandedThumb: { enabled: true, clickToLoad: true, playLabel: "Watch demo" }, ctaEnd: { enabled: true, button: { label: "Offer", url: "https://example.com" }, showReplay: true }, ...(intro ? { introCard: { enabled: true, dismissible: true, title: "Welcome" } } : {}) })}'></player-stack><button id="after">After</button><script src="/assets/playerstack.min.js"></script></html>`,
    });
  });
  await page.goto(origin);
  await expect(page.locator(".playerstack-thumb-play")).toBeAttached();
  if (intro) await expect(page.locator(".playerstack-intro-card")).toBeVisible();
}
async function visibleFocus(target: Locator) {
  await expect(target).toBeFocused();
  expect(
    await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!hit && (hit === el || el.contains(hit));
    }),
  ).toBe(true);
}
async function end(page: Page) {
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0),
    )
    .toBe(true);
  await page.locator("video").evaluate((v: HTMLVideoElement) => {
    v.currentTime = v.duration - 0.15;
  });
  await expect(page.locator(".playerstack-cta")).toBeVisible();
}
for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("CTA has only visible forward and reverse Tab stops and replays with Enter", async ({
      page,
    }) => {
      await open(page);
      await page.locator("#before").focus();
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator(".playerstack-thumb-play"));
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator("#after"));
      await page.keyboard.press("Shift+Tab");
      await visibleFocus(page.locator(".playerstack-thumb-play"));
      await page.keyboard.press("Enter");
      await expect(page.locator("media-play-button")).toBeFocused();
      await end(page);
      await visibleFocus(page.locator(".playerstack-cta-button"));
      await page.locator("#before").focus();
      for (const selector of [".playerstack-cta-button", ".playerstack-cta-replay", "#after"]) {
        await page.keyboard.press("Tab");
        await visibleFocus(page.locator(selector));
      }
      for (const selector of [".playerstack-cta-replay", ".playerstack-cta-button", "#before"]) {
        await page.keyboard.press("Shift+Tab");
        await visibleFocus(page.locator(selector));
      }
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await expect(page.locator(".playerstack-cta")).toHaveCount(0);
      await expect(page.locator("media-play-button")).toBeFocused();
      await expect
        .poll(() =>
          page.locator("video").evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime < 3),
        )
        .toBe(true);
    });
    test("ending leaves external focus alone", async ({ page }) => {
      await open(page);
      await page.locator(".playerstack-thumb-play").click();
      await page.locator("#after").focus();
      await end(page);
      await expect(page.locator("#after")).toBeFocused();
    });
    test("intro card covers thumbnail and dismissal restores it", async ({ page }) => {
      await open(page, true);
      await page.locator("#before").focus();
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator(".playerstack-intro-card-close"));
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator(".playerstack-intro-card-play"));
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator("#after"));
      await page.keyboard.press("Shift+Tab");
      await visibleFocus(page.locator(".playerstack-intro-card-play"));
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Enter");
      await visibleFocus(page.locator(".playerstack-thumb-play"));
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator("#after"));
    });
  });
}
