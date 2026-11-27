import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// CTA cards during playback and action-bar windows, on the built standalone script.
const origin = "http://127.0.0.1:15186";
const dist = process.env.PLAYERSTACK_DIST || resolve("packages/embed/dist");
const shots = process.env.TIMED_SHOTS;
const mp4 = readFileSync(resolve("apps/docs/public/demo.mp4"));
const src = `${origin}/demo.mp4`;
const button = { label: "Offer", url: "https://example.com" };

async function open(page: Page, config: Record<string, unknown>, savedAt?: number) {
  const requested: string[] = [];
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.fulfill({ body: "external", contentType: "text/html" });
    if (url.pathname === "/demo.mp4") {
      const match = route
        .request()
        .headers()
        ["range"]?.match(/^bytes=(\d+)-(\d*)$/);
      const start = match ? Number(match[1]) : 0;
      const end = match?.[2] ? Math.min(Number(match[2]), mp4.length - 1) : mp4.length - 1;
      return route.fulfill({
        status: match ? 206 : 200,
        body: mp4.subarray(start, end + 1),
        contentType: "video/mp4",
        headers: {
          "Accept-Ranges": "bytes",
          ...(match ? { "Content-Range": `bytes ${start}-${end}/${mp4.length}` } : {}),
        },
      });
    }
    if (url.pathname.startsWith("/assets/")) {
      requested.push(url.pathname.split("/").pop()!);
      return route.fulfill({
        body: readFileSync(resolve(dist, url.pathname.split("/").pop()!)),
        contentType: "application/javascript",
      });
    }
    const seed =
      savedAt === undefined
        ? ""
        : `<script>localStorage.setItem("playerstack:pos:${src}", "${savedAt}")</script>`;
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html lang="en"><meta charset="utf-8"><style>body{margin:16px}player-stack{max-width:720px;margin:0 auto}</style>${seed}<script>window.sent=[];window.gtag=(_,name,data)=>sent.push([name,data])</script><player-stack src="${src}" data-config='${JSON.stringify(config)}'></player-stack><script src="/assets/playerstack.min.js"></script></html>`,
    });
  });
  await page.goto(origin);
  await expect(page.locator("media-play-button")).toBeVisible();
  return requested;
}

const video = (page: Page) =>
  page.locator("video").evaluate((v: HTMLVideoElement) => ({
    paused: v.paused,
    time: v.currentTime,
  }));
const seek = (page: Page, time: number) =>
  page.locator("video").evaluate((v: HTMLVideoElement, t) => {
    v.currentTime = t;
  }, time);
const sent = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { sent: [string, unknown][] }).sent
      .map(([name]) => name)
      .filter((name) => /^(cta|action-bar):/.test(name)),
  );
const analytics = {
  enabled: true,
  provider: "gtag",
  forwardBusEvents: ["cta:show", "cta:skip", "action-bar:show"],
};

async function shot(page: Page, name: string) {
  if (!shots) return;
  const project = test.info().project.name;
  await page.screenshot({ path: `${shots}/${project}-${page.viewportSize()!.width}-${name}.png` });
}

for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("pauses at the configured second and resumes from skip by keyboard", async ({ page }) => {
      const requested = await open(page, {
        ctaEnd: { enabled: true, at: 2, title: "Halfway offer", button, skipLabel: "Pomiń" },
        analytics,
      });
      await page.locator("media-play-button").click();
      const card = page.locator(".playerstack-cta");
      await expect(card).toBeVisible();
      await expect.poll(async () => (await video(page)).paused).toBe(true);
      const stopped = (await video(page)).time;
      expect(stopped).toBeGreaterThanOrEqual(2);
      expect(stopped).toBeLessThan(4);
      await expect(page.locator(".playerstack-cta-button")).toBeFocused();
      expect(
        await page.locator("media-controller").evaluate((el) => el.hasAttribute("inert")),
      ).toBe(true);
      expect(requested.filter((file) => file === "playerstack-cta-end-timed.js")).toHaveLength(1);
      await shot(page, "cta-midway");
      const skip = page.locator(".playerstack-cta-skip");
      await skip.focus();
      await page.keyboard.press("Enter");
      await expect(card).toHaveCount(0);
      await expect(page.locator("media-play-button")).toBeFocused();
      await expect.poll(async () => (await video(page)).time).toBeGreaterThan(stopped + 0.5);
      await seek(page, 0);
      await expect.poll(async () => (await video(page)).time).toBeGreaterThan(2.5);
      await expect(card).toHaveCount(0);
      expect(await sent(page)).toEqual(["cta:show", "cta:skip"]);
    });

    test("shows at the start when playback begins at the beginning", async ({ page }) => {
      await open(page, {
        ctaEnd: { enabled: true, at: "start", title: "Before you watch" },
        savedPosition: { enabled: true, endTolerance: 0 },
      });
      await expect(page.locator(".playerstack-cta")).toHaveCount(0);
      await page.locator("media-play-button").click();
      await expect(page.locator(".playerstack-cta")).toBeVisible();
      await expect.poll(async () => (await video(page)).paused).toBe(true);
      await page.locator(".playerstack-cta-skip").click();
      await expect.poll(async () => (await video(page)).paused).toBe(false);
      await expect(page.locator(".playerstack-cta")).toHaveCount(0);
    });

    test("keeps the start card away from a restored position", async ({ page }) => {
      const requested = await open(
        page,
        {
          ctaEnd: { enabled: true, at: "start", title: "Before you watch" },
          savedPosition: { enabled: true, endTolerance: 0 },
        },
        6,
      );
      await expect.poll(() => requested).toContain("playerstack-cta-end-timed.js");
      await page.locator("media-play-button").click();
      await expect.poll(async () => (await video(page)).time).toBeGreaterThan(7);
      await expect(page.locator(".playerstack-cta")).toHaveCount(0);
    });

    test("shows a skipped session card only once across reloads", async ({ page }) => {
      await open(page, { ctaEnd: { enabled: true, atPercent: 10, frequency: "session" } });
      await page.locator("media-play-button").click();
      await page.locator(".playerstack-cta-skip").click();
      await page.reload();
      await page.locator("media-play-button").click();
      await expect.poll(async () => (await video(page)).time).toBeGreaterThan(2.5);
      await expect(page.locator(".playerstack-cta")).toHaveCount(0);
    });

    test("never loads the extra module for a plain end card", async ({ page }) => {
      const requested = await open(page, { ctaEnd: { enabled: true, title: "Thanks" } });
      await page.locator("media-play-button").click();
      await seek(page, 11.8);
      await expect(page.locator(".playerstack-cta")).toBeVisible();
      await expect(page.locator(".playerstack-cta-skip")).toHaveCount(0);
      expect(requested).not.toContain("playerstack-cta-end-timed.js");
    });

    test("stays paused under the card after the email gate closes", async ({ page }) => {
      await open(page, {
        ctaEnd: { enabled: true, at: 2, button },
        emailGate: { enabled: true, at: 2, remember: false },
      });
      await page.locator("media-play-button").click();
      const gate = page.locator(".playerstack-email-gate");
      await expect(gate).toBeVisible();
      await expect(page.locator(".playerstack-cta")).toBeAttached();
      await expect(gate.locator("input[type=email]")).toBeFocused();
      await gate.locator("input[type=email]").fill("viewer@example.com");
      await page.keyboard.press("Enter");
      await expect(gate).toHaveCount(0);
      await expect(page.locator(".playerstack-cta-button")).toBeFocused();
      const held = (await video(page)).time;
      await expect.poll(async () => (await video(page)).paused).toBe(true);
      expect((await video(page)).time).toBeLessThan(held + 0.5);
      await page.locator(".playerstack-cta-skip").click();
      await expect.poll(async () => (await video(page)).paused).toBe(false);
    });

    test("shows a corner badge only inside its window", async ({ page }) => {
      await open(page, {
        actionBar: { enabled: true, variant: "badge", showAt: 3, hideAt: 6, button },
        analytics,
      });
      const badge = page.locator(".playerstack-action-bar-badge");
      await page.locator("media-play-button").click();
      await expect(badge).toHaveCount(0);
      await seek(page, 3.5);
      await expect(badge).toBeVisible();
      const box = (await badge.boundingBox())!;
      const player = (await page.locator("player-stack").boundingBox())!;
      expect(box.width).toBeLessThan(player.width / 1.5);
      expect(Math.round(player.x + player.width - box.x - box.width)).toBe(8);
      expect(Math.round(box.y - player.y)).toBe(8);
      await shot(page, "badge");
      await seek(page, 8);
      await expect(badge).toHaveCount(0);
      await seek(page, 4);
      await expect(badge).toBeVisible();
      expect(await sent(page)).toEqual(["action-bar:show"]);
    });

    test("reports a bar that is there from the start", async ({ page }) => {
      await open(page, { actionBar: { enabled: true, hideAt: 6, button }, analytics });
      await expect(page.locator(".playerstack-action-bar")).toBeVisible();
      await expect.poll(() => sent(page)).toEqual(["action-bar:show"]);
    });
  });
}
