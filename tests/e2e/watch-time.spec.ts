import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const origin = "http://127.0.0.1:15186";
const dist = process.env.PLAYERSTACK_DIST || resolve("packages/embed/dist");
const mp4 = readFileSync(resolve("apps/docs/public/demo.mp4"));

interface Progress {
  maxPosition: number;
  previousMaxPosition: number;
  watchedSeconds: number;
  watchedDelta: number;
  duration: number;
  percent: number;
}

async function open(page: Page) {
  // Beacons are kept in sessionStorage so the one sent while leaving survives.
  await page.addInitScript(() => {
    navigator.sendBeacon = (_url, body) => {
      const all = JSON.parse(sessionStorage.getItem("beacons") || "[]");
      all.push(JSON.parse(body as string));
      sessionStorage.setItem("beacons", JSON.stringify(all));
      return true;
    };
  });
  const config = {
    analytics: { enabled: true, endpoint: `${origin}/track`, watchTime: true },
  };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) throw new Error(`Unexpected external request: ${url}`);
    if (url.pathname === "/demo.mp4") {
      // WebKit only plays media served with byte ranges.
      const match = route
        .request()
        .headers()
        ["range"]?.match(/^bytes=(\d*)-(\d*)$/);
      const from = match?.[1] ? Number(match[1]) : 0;
      const to = match?.[2] ? Math.min(Number(match[2]), mp4.length - 1) : mp4.length - 1;
      return route.fulfill({
        status: match ? 206 : 200,
        body: mp4.subarray(from, to + 1),
        contentType: "video/mp4",
        headers: {
          "Accept-Ranges": "bytes",
          ...(match ? { "Content-Range": `bytes ${from}-${to}/${mp4.length}` } : {}),
        },
      });
    }
    if (url.pathname.startsWith("/assets/"))
      return route.fulfill({
        body: readFileSync(resolve(dist, url.pathname.split("/").pop()!)),
        contentType: "application/javascript",
      });
    if (url.pathname === "/away") return route.fulfill({ contentType: "text/html", body: "away" });
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><meta charset="utf-8">
      <player-stack src="${origin}/demo.mp4" data-config='${JSON.stringify(config)}' style="display:block;width:640px;height:360px"></player-stack>
      <script src="/assets/playerstack.min.js"></script>`,
    });
  });
  await page.goto(origin);
  await expect(page.locator("media-controller")).toBeVisible();
}

const events = (page: Page) =>
  page.evaluate(() =>
    (JSON.parse(sessionStorage.getItem("beacons") || "[]") as { event: string; data: unknown }[])
      .filter((e) => e.event === "watch_progress")
      .map((e) => e.data),
  ) as Promise<Progress[]>;

const video = (page: Page) => page.locator("media-controller video");
const time = (page: Page) => video(page).evaluate((v: HTMLVideoElement) => v.currentTime);
const playUntil = async (page: Page, seconds: number) => {
  await video(page).evaluate((v: HTMLVideoElement) => v.play());
  await expect.poll(() => time(page), { intervals: [50] }).toBeGreaterThan(seconds);
};
const seek = (page: Page, to: number) =>
  video(page).evaluate(
    (v: HTMLVideoElement, target) =>
      new Promise<void>((done) => {
        v.addEventListener("seeked", () => done(), { once: true });
        v.currentTime = target;
      }),
    to,
  );

test("real playback reports watched time without the skipped part", async ({ page }) => {
  await open(page);
  await playUntil(page, 1.5);
  await video(page).evaluate((v: HTMLVideoElement) => v.pause());
  await expect.poll(async () => (await events(page)).length).toBe(1);
  const [first] = await events(page);
  const pausedAt = await time(page);
  expect(first!.previousMaxPosition).toBe(0);
  expect(Math.abs(first!.maxPosition - pausedAt)).toBeLessThan(0.3);
  expect(Math.abs(first!.watchedSeconds - pausedAt)).toBeLessThan(0.5);
  const duration = await video(page).evaluate((v: HTMLVideoElement) => v.duration);
  expect(Math.abs(first!.duration - duration)).toBeLessThan(0.1);

  // Skip to one second before the end and watch to the end.
  await seek(page, duration - 1);
  expect(await events(page)).toHaveLength(1);
  await video(page).evaluate((v: HTMLVideoElement) => v.play());
  await expect.poll(async () => (await events(page)).length).toBe(2);
  const second = (await events(page))[1]!;
  expect(second.percent).toBeGreaterThanOrEqual(99);
  expect(second.previousMaxPosition).toBe(first!.maxPosition);
  expect(second.watchedDelta).toBeGreaterThan(0.5);
  expect(second.watchedDelta).toBeLessThan(1.3);
  expect(second.watchedSeconds).toBeCloseTo(first!.watchedSeconds + second.watchedDelta, 5);
});

test("leaving the page during playback sends the last batch", async ({ page }) => {
  await open(page);
  await playUntil(page, 1);
  expect(await events(page)).toHaveLength(0);
  await page.goto(`${origin}/away`);
  const sent = await events(page);
  expect(sent).toHaveLength(1);
  expect(sent[0]!.watchedSeconds).toBeGreaterThan(0.5);
});
