import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";
import {
  DIST,
  ORIGIN,
  SCRIPT,
  SOURCES,
  openEmbed,
  lazyFiles,
  observeStandalone,
} from "./standalone-helpers";

// Exercises built standalone files as classic scripts from another origin.
observeStandalone();

test("YouTube loads only the youtube provider", async ({ page }) => {
  const fetched = await openEmbed(page, SOURCES.youtube);
  await expect(page.locator("player-stack youtube-video")).toBeAttached();
  expect(await page.evaluate(() => !!customElements.get("youtube-video"))).toBe(true);
  expect(lazyFiles(fetched)).toEqual([
    expect.stringMatching(/^playerstack-youtube\.js\?v=[0-9a-f]{8}$/),
  ]);
});

test("MP4 loads no provider file", async ({ page }) => {
  const fetched = await openEmbed(page, SOURCES.mp4);
  await expect(page.locator("player-stack video")).toHaveAttribute("src", SOURCES.mp4);
  expect(lazyFiles(fetched)).toEqual([]);
  expect(await page.evaluate(() => !!customElements.get("youtube-video"))).toBe(false);
});

test("Shift+? opens keyboard help with shortcut content and Escape closes it", async ({ page }) => {
  const fetched = await openEmbed(page, SOURCES.mp4);
  const play = page.locator("player-stack media-play-button");
  await play.focus();
  await page.keyboard.press("Shift+?");
  const dialog = page.locator("player-stack media-keyboard-shortcuts-dialog");
  await expect(dialog).toBeAttached();
  expect(await page.evaluate(() => !!customElements.get("media-keyboard-shortcuts-dialog"))).toBe(
    true,
  );
  await expect(dialog.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();
  await expect(dialog.locator(".shortcuts-table tr")).not.toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(lazyFiles(fetched)).toEqual([]);
});

test("HLS loads only the hls provider next to the main script and plays in Chromium", async ({
  page,
}) => {
  const fetched = await openEmbed(page, SOURCES.hls);
  const hls = page.locator("player-stack hls-video");
  await expect(hls).toBeAttached();
  expect(lazyFiles(fetched)).toEqual([
    expect.stringMatching(/^playerstack-hls\.js\?v=[0-9a-f]{8}$/),
  ]);
  await expect
    .poll(() => hls.evaluate((el) => (el as HTMLMediaElement).readyState), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);
});

test("Vimeo loads only the vimeo provider", async ({ page }) => {
  await page.route("https://player.vimeo.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>stub</title>" }),
  );
  const fetched = await openEmbed(page, SOURCES.vimeo);
  await expect(page.locator("player-stack vimeo-video")).toBeAttached();
  await expect(page.locator("player-stack vimeo-video iframe")).toHaveAttribute(
    "src",
    /^https:\/\/player\.vimeo\.com\/video\/76979871\b/,
  );
  expect(await page.evaluate(() => !!customElements.get("vimeo-video"))).toBe(true);
  expect(lazyFiles(fetched)).toEqual([
    expect.stringMatching(/^playerstack-vimeo\.js\?v=[0-9a-f]{8}$/),
  ]);
});

test("Wistia loads only the wistia provider and the Wistia script for the media id", async ({
  page,
}) => {
  const wistiaScript = page.waitForRequest("https://fast.wistia.com/assets/external/E-v1.js");
  await page.route("https://fast.wistia.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.Wistia = {}; window._wq = [];",
    }),
  );
  const fetched = await openEmbed(page, "https://home.wistia.com/medias/abc123xyz");
  await expect(page.locator("player-stack wistia-video .wistia_embed")).toHaveClass(
    /\bwistia_async_abc123xyz\b/,
  );
  await wistiaScript;
  expect(lazyFiles(fetched)).toEqual([
    expect.stringMatching(/^playerstack-wistia\.js\?v=[0-9a-f]{8}$/),
  ]);
});

for (const form of ["embed/medias", "embed/iframe"]) {
  test(`Wistia ${form} URLs reach the player with the bare media id (#36)`, async ({ page }) => {
    await page.route("https://fast.wistia.com/**", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "window.Wistia = {}; window._wq = [];",
      }),
    );
    await openEmbed(page, `https://fast.wistia.com/${form}/abc123xyz`);
    await expect(page.locator("player-stack wistia-video .wistia_embed")).toHaveClass(
      /(^|\s)wistia_async_abc123xyz(\s|$)/,
    );
  });
}

test("Twitch loads only the twitch provider and embeds the channel for this host", async ({
  page,
}) => {
  await page.route("https://player.twitch.tv/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>stub</title>" }),
  );
  const fetched = await openEmbed(page, "https://www.twitch.tv/somechannel");
  const iframe = page.locator("player-stack twitch-video iframe");
  await expect(iframe).toHaveAttribute("src", /^https:\/\/player\.twitch\.tv\/\?/);
  const src = new URL((await iframe.getAttribute("src"))!);
  expect(src.searchParams.get("channel")).toBe("somechannel");
  expect(src.search).toContain("ps.test");
  expect(lazyFiles(fetched)).toEqual([
    expect.stringMatching(/^playerstack-twitch\.js\?v=[0-9a-f]{8}$/),
  ]);
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
      body: `<!doctype html><html><head><meta charset="utf-8"></head><body>
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

/** Serves the page and bundle, holding provider files back by `delayMs`. */
async function openWithSlowProviders(page: Page, src: string, delayMs: number): Promise<void> {
  await page.route(`${ORIGIN}/assets/*`, async (route) => {
    const file = new URL(route.request().url()).pathname.split("/").pop()!;
    if (file !== "playerstack.min.js") await new Promise((r) => setTimeout(r, delayMs));
    return route.fulfill({
      body: readFileSync(join(DIST, file)),
      contentType: "application/javascript",
    });
  });
  await page.route(`${ORIGIN}/`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta charset="utf-8"></head><body>
        <player-stack src="${src}"></player-stack>
        <script src="${SCRIPT}"></script>
      </body></html>`,
    }),
  );
  // The load event waits for injected provider scripts; act right after DOMContentLoaded.
  await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("player-stack hls-video")).toHaveCount(0);
}

test("a src change while the provider downloads is not lost", async ({ page }) => {
  const second = `${SOURCES.hls}?second=1`;
  await openWithSlowProviders(page, SOURCES.hls, 800);
  await page.locator("player-stack").evaluate((el, s) => el.setAttribute("src", s), second);
  await expect(page.locator("player-stack hls-video")).toHaveAttribute("src", second);
});

test("switching the source type while a provider downloads picks the new element", async ({
  page,
}) => {
  await openWithSlowProviders(page, SOURCES.hls, 800);
  await page.locator("player-stack").evaluate((el, s) => el.setAttribute("src", s), SOURCES.mp4);
  await expect(page.locator("player-stack video")).toHaveAttribute("src", SOURCES.mp4);
  await expect(page.locator("player-stack hls-video")).toHaveCount(0);
});

test("moving the player while its provider downloads builds a single controller", async ({
  page,
}) => {
  await openWithSlowProviders(page, SOURCES.hls, 800);
  await page.evaluate(() => {
    const target = document.body.appendChild(document.createElement("section"));
    target.appendChild(document.querySelector("player-stack")!);
  });
  await expect(page.locator("section > player-stack hls-video")).toBeAttached();
  await expect(page.locator("player-stack media-controller")).toHaveCount(1);
  await expect(page.locator("player-stack media-controller")).toBeVisible();
});

test("removing the player while its provider downloads leaves it empty", async ({ page }) => {
  await openWithSlowProviders(page, SOURCES.hls, 800);
  await page.evaluate(() => {
    const el = document.querySelector("player-stack")!;
    (window as { removed?: Element }).removed = el;
    el.remove();
  });
  await expect.poll(() => page.evaluate(() => !!customElements.get("hls-video"))).toBe(true);
  // Give a boot that ignored the removal time to build its controller.
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(
      () => (window as { removed?: Element }).removed!.querySelector("media-controller") === null,
    ),
  ).toBe(true);
});
