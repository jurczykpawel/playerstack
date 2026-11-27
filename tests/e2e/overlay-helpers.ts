import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Serves the built standalone script and the demo video; nothing leaves the machine.
export const origin = "http://127.0.0.1:15185";
const dist = process.env.PLAYERSTACK_DIST || resolve("packages/embed/dist");
const mp4 = readFileSync(resolve("apps/docs/public/demo.mp4"));

export async function open(page: Page, config: Record<string, unknown>) {
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
      return route.fulfill({
        body: readFileSync(resolve(dist, url.pathname.split("/").pop()!)),
        contentType: "application/javascript",
      });
    }
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html lang="en"><meta charset="utf-8"><style>body{margin:16px}player-stack{max-width:720px;margin:0 auto}.spacer{height:2000px}</style><player-stack src="${origin}/demo.mp4" data-config='${JSON.stringify(config)}'></player-stack><div class="spacer"></div><script src="/assets/playerstack.min.js"></script></html>`,
    });
  });
  await page.goto(origin);
  await expect(page.locator("media-fullscreen-button")).toBeVisible();
}

export const fullscreenTag = (page: Page) =>
  page.evaluate(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element };
    return (doc.fullscreenElement ?? doc.webkitFullscreenElement)?.tagName ?? null;
  });

export async function enter(page: Page) {
  await page.locator("media-fullscreen-button").click({ timeout: 5000 });
  await expect.poll(() => fullscreenTag(page)).not.toBeNull();
}
