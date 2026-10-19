import { test, expect, type Page, type Request } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Exercises the built standalone bundle (packages/embed/dist) exactly as a
// customer embeds it: one classic <script> from another origin. Run
// `bun run --cwd packages/embed build` first (CI does).
const DIST = join(__dirname, "../../packages/embed/dist");
const ORIGIN = "https://ps.test";
const SCRIPT = `${ORIGIN}/assets/playerstack.min.js`;

const SOURCES = {
  youtube: "https://youtu.be/_cMxraX_5RE",
  mp4: "https://media.w3.org/2010/05/sintel/trailer.mp4",
  hls: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  vimeo: "https://vimeo.com/76979871",
};

test.skip(!existsSync(join(DIST, "playerstack.min.js")), "standalone bundle not built");

async function openEmbed(page: Page, src: string): Promise<string[]> {
  const fetched: string[] = [];
  page.on("request", (req: Request) => {
    if (req.url().startsWith(`${ORIGIN}/assets/`)) fetched.push(req.url().split("/").pop()!);
  });
  await page.route(`${ORIGIN}/assets/*`, (route) => {
    const file = new URL(route.request().url()).pathname.split("/").pop()!;
    const path = join(DIST, file);
    if (!existsSync(path)) return route.fulfill({ status: 404 });
    return route.fulfill({ body: readFileSync(path), contentType: "application/javascript" });
  });
  await page.route(`${ORIGIN}/`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body>
        <player-stack src="${src}" style="display:block;width:640px;height:360px"></player-stack>
        <script src="${SCRIPT}"></script>
      </body></html>`,
    }),
  );
  await page.goto(`${ORIGIN}/`);
  await expect(page.locator("player-stack media-controller")).toBeAttached();
  return fetched;
}

const providerFiles = (files: string[]) => files.filter((f) => f !== "playerstack.min.js");

test("YouTube loads no provider file", async ({ page }) => {
  const fetched = await openEmbed(page, SOURCES.youtube);
  await expect(page.locator("player-stack youtube-video")).toBeAttached();
  expect(providerFiles(fetched)).toEqual([]);
});

test("MP4 loads no provider file", async ({ page }) => {
  const fetched = await openEmbed(page, SOURCES.mp4);
  await expect(page.locator("player-stack video")).toHaveAttribute("src", SOURCES.mp4);
  expect(providerFiles(fetched)).toEqual([]);
});

test("HLS loads only the hls provider next to the main script and plays in Chromium", async ({
  page,
}) => {
  const fetched = await openEmbed(page, SOURCES.hls);
  const hls = page.locator("player-stack hls-video");
  await expect(hls).toBeAttached();
  expect(providerFiles(fetched)).toEqual([expect.stringMatching(/^playerstack-hls\.\w+\.js$/)]);
  await expect
    .poll(() => hls.evaluate((el) => (el as HTMLMediaElement).readyState), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
});

test("Vimeo loads only the vimeo provider", async ({ page }) => {
  const fetched = await openEmbed(page, SOURCES.vimeo);
  await expect(page.locator("player-stack vimeo-video")).toBeAttached();
  expect(await page.evaluate(() => !!customElements.get("vimeo-video"))).toBe(true);
  expect(providerFiles(fetched)).toEqual([expect.stringMatching(/^playerstack-vimeo\.\w+\.js$/)]);
});

test("a failed provider download logs an error and emits playerstack:error", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.route(`${ORIGIN}/assets/playerstack-hls.*`, (route) => route.abort());
  await page.route(`${ORIGIN}/`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body>
        <script>document.addEventListener("playerstack:error", (e) => { window.__psError = e.detail.tag; });</script>
        <player-stack src="${SOURCES.hls}"></player-stack>
        <script src="${SCRIPT}"></script>
      </body></html>`,
    }),
  );
  await page.route(`${ORIGIN}/assets/playerstack.min.js`, (route) =>
    route.fulfill({
      body: readFileSync(join(DIST, "playerstack.min.js")),
      contentType: "application/javascript",
    }),
  );
  await page.goto(`${ORIGIN}/`);
  await expect
    .poll(() => page.evaluate(() => (window as { __psError?: string }).__psError))
    .toBe("hls-video");
  expect(errors.some((e) => e.includes("[playerstack] could not load <hls-video>"))).toBe(true);
});
