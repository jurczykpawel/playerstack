import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const origin = "http://127.0.0.1:15183";
const dist = process.env.PLAYERSTACK_DIST || resolve("packages/embed/dist");
const mp4 = readFileSync(resolve("apps/docs/public/demo.mp4"));

async function open(page: Page, config: Record<string, unknown>) {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/demo.mp4")) requests.push(request.url());
  });
  await page.addInitScript(() => {
    const state = { autoplayAtConnection: [] as boolean[], plays: 0 };
    Object.assign(window, { mediaObservation: state });
    document.addEventListener("play", () => state.plays++, true);
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          const videos = node.matches("video") ? [node] : [...node.querySelectorAll("video")];
          for (const video of videos)
            state.autoplayAtConnection.push(video.hasAttribute("autoplay"));
        }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) throw new Error(`Unexpected external request: ${url}`);
    if (url.pathname === "/demo.mp4") {
      return route.fulfill({ body: mp4, contentType: "video/mp4" });
    }
    if (url.pathname.startsWith("/assets/")) {
      return route.fulfill({
        body: readFileSync(resolve(dist, url.pathname.split("/").pop()!)),
        contentType: "application/javascript",
      });
    }
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><body>
      <button id="before">Before</button>
      <player-stack src="${origin}/demo.mp4" data-config='${JSON.stringify(config)}' style="display:block;width:640px;height:360px"></player-stack>
      <button id="after">After</button><script src="/assets/playerstack.min.js"></script>`,
    });
  });
  await page.goto(origin);
  await expect(page.locator("media-controller")).toBeVisible();
  return requests;
}

async function playing(page: Page) {
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0),
    )
    .toBe(true);
}

for (const preview of [false, true]) {
  test(`preload none defers MP4 until play (preview ${preview})`, async ({ page }) => {
    const requests = await open(page, { preload: "none", preview: { enabled: preview } });
    // A bounded negative observation catches delayed load/IntersectionObserver work after init.
    await expect(
      page.waitForRequest((r) => r.url().endsWith("/demo.mp4"), { timeout: 750 }),
    ).rejects.toThrow(/Timeout/);
    expect(requests).toEqual([]);
    await expect(page.locator("video")).toHaveAttribute("preload", "none");
    await page.locator("media-play-button").click();
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    await playing(page);
  });
}

test("reduced motion prevents preview from its first connection", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, { preview: { enabled: true } });
  const observation = () =>
    page.evaluate(() => (window as unknown as { mediaObservation: unknown }).mediaObservation);
  await expect(observation).resolves.toEqual({ autoplayAtConnection: [false], plays: 0 });
  await expect(page.locator("video")).not.toHaveAttribute("autoplay", "");
  // Observe long enough for a native autoplay task; no positive state exists for continued silence.
  await expect(
    page.waitForFunction(
      () =>
        (window as unknown as { mediaObservation: { plays: number } }).mediaObservation.plays > 0,
      {},
      { timeout: 750 },
    ),
  ).rejects.toThrow(/Timeout/);
  await expect(observation).resolves.toEqual({ autoplayAtConnection: [false], plays: 0 });
});

test("normal motion preview actually plays", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, { preview: { enabled: true } });
  await playing(page);
  await expect(page.locator("video")).toHaveJSProperty("muted", true);
});

test("thumbnail is the only Tab stop across the entire player", async ({ page }) => {
  await open(page, { brandedThumb: { enabled: true, playLabel: "Watch demo" } });
  await expect(page.locator(".playerstack-thumb")).toBeVisible();
  await page.locator("#before").focus();
  const stops: string[] = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    if (await page.locator("#after").evaluate((el) => el === document.activeElement)) break;
    stops.push(
      await page.evaluate(() => {
        let active = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return active?.closest("player-stack") || document.activeElement?.closest("player-stack")
          ? `${active?.tagName}:${active?.getAttribute("aria-label")}`
          : "outside player";
      }),
    );
  }
  await expect(page.locator("#after")).toBeFocused();
  expect(stops).toEqual(["BUTTON:Watch demo"]);
});

for (const key of ["Enter", "Space"]) {
  test(`thumbnail has one named Tab stop and plays with ${key}`, async ({ page }) => {
    await open(page, { brandedThumb: { enabled: true, playLabel: "Watch demo" } });
    const overlay = page.locator(".playerstack-thumb");
    await expect(overlay).toBeVisible();
    const stops = overlay.locator('button, [tabindex="0"]');
    // Include the overlay itself when it participates in the tab order.
    expect(
      (await stops.count()) +
        (await overlay.evaluate((el) => (el.getAttribute("tabindex") === "0" ? 1 : 0))),
    ).toBe(1);
    await page.locator("#after").focus();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Watch demo", exact: true })).toBeFocused();
    await page.keyboard.press(key);
    await expect(overlay).toHaveCount(0);
    await playing(page);
    await expect(page.locator("media-play-button")).toBeFocused();
    await expect(page.locator("media-controller")).not.toHaveAttribute("mediapaused", "");
    await page.keyboard.press("Space");
    await expect(page.locator("video")).toHaveJSProperty("paused", true);
  });
}

test("thumbnail background click starts playback", async ({ page }) => {
  await open(page, { brandedThumb: { enabled: true } });
  await page.locator(".playerstack-thumb").click({ position: { x: 10, y: 10 } });
  await expect(page.locator(".playerstack-thumb")).toHaveCount(0);
  await playing(page);
});

for (const key of ["Enter", "Space"]) {
  test(`thumbnail falls back to controller with hidden play after ${key}`, async ({ page }) => {
    await open(page, { brandedThumb: { enabled: true }, controls: { show: ["progress"] } });
    await expect(page.locator("media-play-button")).toBeHidden();
    await page.getByRole("button", { name: "Play video", exact: true }).focus();
    await page.keyboard.press(key);
    await playing(page);
    await expect(page.locator("media-controller")).toBeFocused();
    await expect(page.locator("media-controller")).not.toHaveAttribute("mediapaused", "");
    await page.keyboard.press("Space");
    await expect(page.locator("video")).toHaveJSProperty("paused", true);
  });
}

for (const target of [".playerstack-thumb-play", ".playerstack-thumb"]) {
  test(`thumbnail mouse click does not move focus to play (${target})`, async ({ page }) => {
    await open(page, { brandedThumb: { enabled: true } });
    await page
      .locator(target)
      .click(target === ".playerstack-thumb" ? { position: { x: 10, y: 10 } } : {});
    await playing(page);
    await expect(page.locator("media-play-button")).not.toBeFocused();
  });
}
