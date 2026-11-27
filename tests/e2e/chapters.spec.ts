import { test, expect, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const origin = "http://127.0.0.1:15186";
const dist = resolve("packages/embed/dist");
const video = readFileSync(resolve("apps/docs/public/demo.mp4"));

// demo.mp4 is 12 s long.
const points = [
  { time: 0, label: "Intro" },
  { time: 3, label: "Setup" },
  { time: 9, label: "Deploy" },
];

test.skip(!existsSync(resolve(dist, "playerstack.min.js")), "standalone bundle not built");

async function open(page: Page, chapters: Record<string, unknown>, extra = {}) {
  const config = { chapters: { points, ...chapters }, ...extra };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) throw new Error(`Unexpected external request: ${url}`);
    if (url.pathname === "/demo.mp4") {
      // WebKit only plays media served with byte ranges.
      const match = route
        .request()
        .headers()
        ["range"]?.match(/^bytes=(\d*)-(\d*)$/);
      const start = match?.[1] ? Number(match[1]) : 0;
      const end = match?.[2] ? Math.min(Number(match[2]), video.length - 1) : video.length - 1;
      const body = video.subarray(start, end + 1);
      return route.fulfill({
        status: match ? 206 : 200,
        body,
        contentType: "video/mp4",
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": String(body.length),
          ...(match ? { "Content-Range": `bytes ${start}-${end}/${video.length}` } : {}),
        },
      });
    }
    if (url.pathname.startsWith("/assets/"))
      return route.fulfill({
        body: readFileSync(resolve(dist, url.pathname.split("/").pop()!)),
        contentType: "application/javascript",
      });
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>body{margin:16px}player-stack{display:block;width:min(100%,720px);aspect-ratio:16/9}</style>
      <button id="before">Before</button>
      <player-stack src="${origin}/demo.mp4" preload="auto" data-config='${JSON.stringify(config)}'></player-stack>
      <script src="/assets/playerstack.min.js"></script></html>`,
    });
  });
  await page.goto(origin);
  await expect(page.locator(".playerstack-chapter")).toHaveCount(points.length);
  await expect.poll(() => main(page).evaluate((v: HTMLVideoElement) => v.duration)).toBe(12);
}

// Safari moves Tab between buttons with Option held.
const tabKey = () => (test.info().project.name.startsWith("webkit") ? "Alt+Tab" : "Tab");
const main = (page: Page) => page.locator("media-controller video");
const time = (page: Page) => main(page).evaluate((v: HTMLVideoElement) => v.currentTime);
const slider = (page: Page) => page.locator("media-time-range input[type=range]");
const segments = (page: Page) => page.locator("media-time-range #segments-clipping rect");
const hoverTitle = (page: Page) => page.locator("media-time-range media-preview-chapter-display");
const keyboardTitle = (page: Page) => page.locator(".playerstack-chapter-title");
const toggle = (page: Page) => page.getByRole("button", { name: "Chapters", exact: true });
const menu = (page: Page) => page.locator(".playerstack-chapters-menu");

/** Viewport coordinates of a moment on the progress bar. */
async function at(page: Page, seconds: number) {
  const box = (await slider(page).boundingBox())!;
  return { x: box.x + (seconds / 12) * box.width, y: box.y + box.height / 2 };
}

test("without the new options the progress bar and control bar are unchanged", async ({ page }) => {
  await open(page, {});
  await expect(segments(page)).toHaveCount(0);
  await expect(toggle(page)).toHaveCount(0);
  await expect(keyboardTitle(page)).toHaveCount(0);
});

test("markers split the bar where chapters start", async ({ page }) => {
  await open(page, { markers: true });
  await expect(segments(page)).toHaveCount(3);
  const track = (await page.locator("media-time-range #appearance").boundingBox())!;
  const starts = await segments(page).evaluateAll((rects) =>
    rects.map((rect) => parseFloat(getComputedStyle(rect).getPropertyValue("width"))),
  );
  expect(starts[0]! / track.width).toBeCloseTo(0.25, 1);
  expect(starts[1]! / track.width).toBeCloseTo(0.5, 1);
  expect(starts[2]! / track.width).toBeCloseTo(0.25, 1);
});

test("hovering the bar names the chapter under the pointer", async ({ page }) => {
  await open(page, { markers: true });
  for (const [seconds, label] of [
    [1.5, "Intro"],
    [6, "Setup"],
    [7, "Setup"],
    [10.5, "Deploy"],
    [2, "Intro"],
  ] as const) {
    const point = await at(page, seconds);
    await page.mouse.move(point.x, point.y);
    await expect(hoverTitle(page)).toHaveText(label);
    await expect(hoverTitle(page)).toBeVisible();
  }
});

test("a click on a marker lands exactly on the chapter start", async ({ page }) => {
  await open(page, { markers: true });
  const marker = await at(page, 9);
  await page.mouse.click(marker.x + 4, marker.y);
  await expect.poll(() => time(page)).toBe(9);
});

test("clicks and drags elsewhere on the bar seek as before", async ({ page }) => {
  await open(page, { markers: true });
  const middle = await at(page, 6);
  await page.mouse.click(middle.x, middle.y);
  await expect.poll(() => time(page)).toBeGreaterThan(5.5);
  expect(await time(page)).toBeLessThan(6.5);
  // A drag across a marker, released next to another one, stays where released.
  const from = await at(page, 1.5);
  const to = await at(page, 9);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x + 4, to.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => time(page)).toBeGreaterThan(9.01);
});

test("keyboard users see and hear the current chapter on the slider", async ({ page }) => {
  await open(page, { markers: true });
  await page.locator("media-mute-button").focus();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    if (await slider(page).evaluate((el) => (el.getRootNode() as ShadowRoot).activeElement === el))
      break;
  }
  await expect(keyboardTitle(page)).toBeVisible();
  await expect(keyboardTitle(page)).toHaveText("Intro");
  await expect(slider(page)).toHaveAttribute("aria-valuetext", /, Intro$/);
  await main(page).evaluate((v: HTMLVideoElement) => (v.currentTime = 9.5));
  await expect(keyboardTitle(page)).toHaveText("Deploy");
  await expect(slider(page)).toHaveAttribute("aria-valuetext", /, Deploy$/);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => time(page)).toBeLessThan(9.5);
  const title = (await keyboardTitle(page).boundingBox())!;
  const player = (await page.locator("player-stack").boundingBox())!;
  const bar = (await page.locator("media-control-bar").boundingBox())!;
  expect(title.x).toBeGreaterThanOrEqual(player.x);
  expect(title.x + title.width).toBeLessThanOrEqual(player.x + player.width);
  expect(title.y + title.height).toBeLessThanOrEqual(bar.y + 12);
  await page.keyboard.press("Tab");
  await expect(keyboardTitle(page)).toBeHidden();
});

test("the menu lists chapters with large targets inside the player", async ({ page }) => {
  await open(page, { markers: true, menu: true });
  const button = (await toggle(page).boundingBox())!;
  expect(Math.min(button.width, button.height)).toBeGreaterThanOrEqual(24);
  const player = (await page.locator("player-stack").boundingBox())!;
  const bar = (await page.locator("media-control-bar").boundingBox())!;
  expect(button.x + button.width).toBeLessThanOrEqual(player.x + player.width);
  // The extra button leaves a usable progress bar on narrow screens.
  expect((await slider(page).boundingBox())!.width).toBeGreaterThanOrEqual(60);
  await toggle(page).click();
  await expect(menu(page)).toBeVisible();
  const panel = (await menu(page).boundingBox())!;
  expect(panel.x).toBeGreaterThanOrEqual(player.x);
  expect(panel.y).toBeGreaterThanOrEqual(player.y);
  expect(panel.x + panel.width).toBeLessThanOrEqual(player.x + player.width);
  expect(panel.y + panel.height).toBeLessThanOrEqual(bar.y);
  for (const item of await menu(page).locator("button").all()) {
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  }
  await menu(page)
    .getByRole("button", { name: /Deploy/ })
    .click();
  await expect.poll(() => time(page)).toBe(9);
  await expect(menu(page)).toBeHidden();
});

test("the menu works from the keyboard without toggling playback", async ({ page }) => {
  await open(page, { menu: true });
  await toggle(page).focus();
  await page.keyboard.press("Enter");
  await expect(menu(page).getByRole("button", { name: /Intro/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeHidden();
  await expect(toggle(page)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press(tabKey());
  await expect(menu(page).getByRole("button", { name: /Setup/ })).toBeFocused();
  await page.keyboard.press("Space");
  await expect.poll(() => time(page)).toBe(3);
  await expect(toggle(page)).toBeFocused();
  await expect(main(page)).toHaveJSProperty("paused", true);
});

test("the menu is usable in fullscreen", async ({ page }) => {
  await open(page, { menu: true });
  await page.locator("media-fullscreen-button").click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await toggle(page).click();
  const item = menu(page).getByRole("button", { name: /Deploy/ });
  await expect(item).toBeVisible();
  expect(
    await item.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === el;
    }),
  ).toBe(true);
  await item.click();
  await expect.poll(() => time(page)).toBe(9);
  // Choosing a chapter is not a click on the video.
  await expect(main(page)).toHaveJSProperty("paused", true);
});

test("an open menu stays visible during playback without pointer activity", async ({ page }) => {
  await open(page, { menu: true });
  await main(page).evaluate((v: HTMLVideoElement) => {
    v.muted = true;
    return v.play();
  });
  await toggle(page).focus();
  await page.keyboard.press("Enter");
  await page.mouse.move(0, 0);
  // media-chrome hides inactive controls after two seconds.
  await page.waitForTimeout(3000);
  await expect(menu(page)).toHaveCSS("opacity", "1");
  await expect(menu(page)).toBeVisible();
});

test("the click-to-load thumbnail keeps the chapters button out of reach", async ({ page }) => {
  const config = { points, markers: true, menu: true };
  await page.addInitScript(() => localStorage.clear());
  await open(page, config, { brandedThumb: { enabled: true } });
  const button = page.locator(".playerstack-chapters-toggle");
  await page.locator("#before").focus();
  await page.keyboard.press(tabKey());
  await expect(page.locator(".playerstack-thumb-play")).toBeFocused();
  await button.evaluate((el: HTMLElement) => el.focus());
  await expect(button).not.toBeFocused();
});

test("a rebuilt player keeps a single set of chapter controls", async ({ page }) => {
  await open(page, { markers: true, menu: true });
  const first = await page.locator(".playerstack-chapters-toggle").elementHandle();
  // Detaching and re-attaching destroys the plugins and boots them again.
  await page.locator("player-stack").evaluate((el) => {
    el.remove();
    document.body.appendChild(el);
  });
  await expect.poll(() => first!.evaluate((el) => el.isConnected)).toBe(false);
  await expect(page.locator(".playerstack-chapters-toggle")).toHaveCount(1);
  await expect(page.locator(".playerstack-chapters-menu")).toHaveCount(1);
  await expect(keyboardTitle(page)).toHaveCount(1);
  await expect(segments(page)).toHaveCount(3);
});
