import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const origin = "http://127.0.0.1:15185";
const dist = process.env.PLAYERSTACK_DIST || resolve("packages/embed/dist");
const files: Record<string, { body: Buffer; type: string }> = {
  "/demo.mp4": { body: readFileSync(resolve("apps/docs/public/demo.mp4")), type: "video/mp4" },
  "/preview.mp4": {
    body: readFileSync(resolve("tests/e2e/fixtures/preview.mp4")),
    type: "video/mp4",
  },
  "/poster.webp": {
    body: readFileSync(resolve("apps/docs/public/demo-poster.webp")),
    type: "image/webp",
  },
};

// WebKit only plays media served with byte ranges.
function fulfillRange(route: Route, { body, type }: { body: Buffer; type: string }) {
  const match = route
    .request()
    .headers()
    ["range"]?.match(/^bytes=(\d*)-(\d*)$/);
  const start = match?.[1] ? Number(match[1]) : 0;
  const end = match?.[2] ? Math.min(Number(match[2]), body.length - 1) : body.length - 1;
  const part = body.subarray(start, end + 1);
  return route.fulfill({
    status: match ? 206 : 200,
    body: part,
    contentType: type,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(part.length),
      ...(match ? { "Content-Range": `bytes ${start}-${end}/${body.length}` } : {}),
    },
  });
}

async function open(page: Page, extra: Record<string, unknown> = {}, below = "") {
  const requests = { full: 0, preview: 0 };
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === "/demo.mp4") requests.full++;
    if (path === "/preview.mp4") requests.preview++;
  });
  const config = {
    poster: `${origin}/poster.webp`,
    preview: { enabled: true, src: `${origin}/preview.mp4`, type: "video/mp4" },
    brandedThumb: { enabled: true, clickToLoad: true, playLabel: "Watch demo" },
    ...extra,
  };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) throw new Error(`Unexpected external request: ${url}`);
    const file = files[url.pathname];
    if (file) return fulfillRange(route, file);
    if (url.pathname === "/challenge") return route.fulfill({ status: 503 });
    if (url.pathname.startsWith("/assets/"))
      return route.fulfill({
        body: readFileSync(resolve(dist, url.pathname.split("/").pop()!)),
        contentType: "application/javascript",
      });
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><meta charset="utf-8"><style>body{margin:16px}player-stack{display:block;width:min(100%,720px);aspect-ratio:16/9}</style>
      <button id="before">Before</button>
      <player-stack src="${origin}/demo.mp4" data-config='${JSON.stringify(config)}'></player-stack>
      <button id="after">After</button>${below}<script src="/assets/playerstack.min.js"></script></html>`,
    });
  });
  await page.goto(origin);
  await expect(page.locator("media-controller")).toBeVisible();
  return requests;
}

const preview = (page: Page) => page.locator("video.playerstack-preview");
const main = (page: Page) => page.locator("media-controller video");
const previewPlaying = (page: Page) =>
  expect
    .poll(() => preview(page).evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0))
    .toBe(true);

async function topmostAtCenter(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
}

test("before play only the light preview is fetched and plays under the play button", async ({
  page,
}) => {
  const requests = await open(page);
  await previewPlaying(page);
  await expect(preview(page)).toHaveJSProperty("muted", true);
  await expect(preview(page)).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("button", { name: "Watch demo", exact: true })).toBeVisible();
  expect(await topmostAtCenter(page, ".playerstack-thumb-play")).toBe(true);
  // Above the poster image, below the play button.
  await expect(
    page.locator(".playerstack-thumb > img + video.playerstack-preview + button"),
  ).toHaveCount(1);
  await expect(
    page.waitForRequest((r) => r.url().endsWith("/demo.mp4"), { timeout: 750 }),
  ).rejects.toThrow(/Timeout/);
  expect(requests.full).toBe(0);
  expect(requests.preview).toBeGreaterThan(0);
  await expect(main(page)).not.toHaveAttribute("autoplay", "");
  await expect(main(page)).not.toHaveAttribute("src", /.+/);
});

for (const how of ["mouse", "Enter", "Space"]) {
  test(`play via ${how} starts the full video from 0:00 with sound`, async ({ page }) => {
    const requests = await open(page);
    await previewPlaying(page);
    const button = page.getByRole("button", { name: "Watch demo", exact: true });
    if (how === "mouse") await button.click();
    else {
      await button.focus();
      await page.keyboard.press(how);
    }
    await expect(page.locator(".playerstack-thumb")).toHaveCount(0);
    await expect(preview(page)).toHaveCount(0);
    const start = await main(page).evaluate(
      (v: HTMLVideoElement) =>
        new Promise<{ time: number; muted: boolean }>((done) =>
          v.paused || v.currentTime === 0
            ? v.addEventListener("playing", () => done({ time: v.currentTime, muted: v.muted }), {
                once: true,
              })
            : done({ time: v.currentTime, muted: v.muted }),
        ),
    );
    expect(start.time).toBeLessThan(0.5);
    expect(start.muted).toBe(false);
    await expect(main(page)).toHaveJSProperty("paused", false);
    await expect(main(page)).toHaveJSProperty("muted", false);
    expect(requests.full).toBeGreaterThan(0);
    await expect(page.locator("media-control-bar")).toBeVisible();
    if (how === "mouse") await expect(page.locator("media-play-button")).not.toBeFocused();
    else await expect(page.locator("media-play-button")).toBeFocused();
  });
}

test("reduced motion shows the static poster and fetches no video", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests = await open(page);
  await expect(page.getByRole("button", { name: "Watch demo", exact: true })).toBeVisible();
  await expect(
    page.waitForRequest((r) => /\/(demo|preview)\.mp4$/.test(r.url()), { timeout: 750 }),
  ).rejects.toThrow(/Timeout/);
  expect(requests).toEqual({ full: 0, preview: 0 });
  await expect(preview(page)).toHaveCount(0);
  await expect(page.locator(".playerstack-thumb img")).toHaveAttribute(
    "src",
    `${origin}/poster.webp`,
  );
  await expect(page.locator(".playerstack-thumb img")).toBeVisible();
});

test("the play button is the only Tab stop across the player", async ({ page }) => {
  await open(page);
  await previewPlaying(page);
  await page.locator("#before").focus();
  const stops: string[] = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    if (await page.locator("#after").evaluate((el) => el === document.activeElement)) break;
    stops.push(
      await page.evaluate(() => {
        let active = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return `${active?.tagName}:${active?.getAttribute("aria-label")}`;
      }),
    );
  }
  await expect(page.locator("#after")).toBeFocused();
  expect(stops).toEqual(["BUTTON:Watch demo"]);
});

test("the preview pauses out of view and resumes in view", async ({ page }) => {
  await open(page, {}, '<div style="height:3000px"></div><p id="far">Far</p>');
  await previewPlaying(page);
  await page.locator("#far").scrollIntoViewIfNeeded();
  await expect(preview(page)).toHaveJSProperty("paused", true);
  await page.locator("player-stack").scrollIntoViewIfNeeded();
  await previewPlaying(page);
});

const gate = (at: "before" | "after") => ({
  emailGate: {
    enabled: true,
    at,
    dismissible: true,
    remember: false,
    product: "Demo",
    webhookUrl: `${origin}/lead`,
    challengeUrl: `${origin}/challenge`,
  },
});

test("email gate before stays on top of the preview with no hidden Tab stops", async ({ page }) => {
  await open(page, gate("before"));
  const form = page.locator(".playerstack-email-gate");
  await expect(form).toBeVisible();
  expect(await topmostAtCenter(page, ".playerstack-email-gate input[type=email]")).toBe(true);
  await expect(page.locator(".playerstack-thumb")).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: /skip|pomiń/i }).click();
  await expect(form).toHaveCount(0);
  await previewPlaying(page);
  expect(await topmostAtCenter(page, ".playerstack-thumb-play")).toBe(true);
  await page.locator("#before").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Watch demo", exact: true })).toBeFocused();
});

test("email gate after appears on top once the full video ends", async ({ page }) => {
  await open(page, gate("after"));
  await previewPlaying(page);
  await page.getByRole("button", { name: "Watch demo", exact: true }).click();
  await expect(main(page)).toHaveJSProperty("paused", false);
  await expect
    .poll(() => main(page).evaluate((v: HTMLVideoElement) => v.duration))
    .toBeGreaterThan(1);
  await main(page).evaluate((v: HTMLVideoElement) => (v.currentTime = v.duration - 0.3));
  await expect(page.locator(".playerstack-email-gate")).toBeVisible();
  expect(await topmostAtCenter(page, ".playerstack-email-gate input[type=email]")).toBe(true);
  await expect(preview(page)).toHaveCount(0);
});
