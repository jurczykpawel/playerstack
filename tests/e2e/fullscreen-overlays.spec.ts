import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Overlays must stay visible in fullscreen and must not cover the control bar.
const origin = "http://127.0.0.1:15185";
const dist = process.env.PLAYERSTACK_DIST || resolve("packages/embed/dist");
const shots = process.env.FULLSCREEN_SHOTS;
const mp4 = readFileSync(resolve("apps/docs/public/demo.mp4"));
const cta = { enabled: true, button: { label: "Offer", url: "https://example.com" } };
const watermark = { enabled: true, text: "jan@example.com" };

async function open(page: Page, config: Record<string, unknown>) {
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

const fullscreenTag = (page: Page) =>
  page.evaluate(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element };
    return (doc.fullscreenElement ?? doc.webkitFullscreenElement)?.tagName ?? null;
  });

async function enter(page: Page) {
  await page.locator("media-fullscreen-button").click({ timeout: 5000 });
  await expect.poll(() => fullscreenTag(page)).not.toBeNull();
}

/** The overlay is part of the fullscreen subtree and is what the viewer hits. */
async function shownInFullscreen(target: Locator) {
  await expect(target).toBeVisible();
  await expect
    .poll(() =>
      target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return {
          contained: !!document.fullscreenElement?.contains(el),
          onTop: !!hit && (hit === el || el.contains(hit)),
        };
      }),
    )
    .toEqual({ contained: true, onTop: true });
}

async function shot(page: Page, name: string) {
  if (!shots) return;
  const project = test.info().project.name;
  await page.screenshot({ path: `${shots}/${project}-${page.viewportSize()!.width}-${name}.png` });
}

async function play(page: Page) {
  await page.locator("video").evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() => page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
}

for (const width of [390, 1440]) {
  test.describe(`fullscreen ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("watermark, action bar, email gate and end CTA show in fullscreen", async ({ page }) => {
      await open(page, {
        watermark: { ...watermark, href: "https://example.com/brand" },
        actionBar: { enabled: true, title: "Course", button: cta.button },
        ctaEnd: cta,
        emailGate: {
          enabled: true,
          at: "after",
          dismissible: true,
          remember: false,
          webhookUrl: `${origin}/lead`,
          challengeUrl: `${origin}/challenge`,
        },
      });
      const inline = await page.locator("player-stack").boundingBox();
      await enter(page);
      expect(await fullscreenTag(page)).toBe("PLAYER-STACK");
      await expect(page.locator("media-fullscreen-button")).toHaveAttribute(
        "mediaisfullscreen",
        "",
      );
      await expect
        .poll(() =>
          page.locator("player-stack").evaluate((el) => {
            const r = el.getBoundingClientRect();
            return [r.x, r.y, r.width - innerWidth, r.height - innerHeight];
          }),
        )
        .toEqual([0, 0, 0, 0]);
      await shownInFullscreen(page.locator(".playerstack-watermark"));
      await shownInFullscreen(page.locator(".playerstack-action-bar"));
      await shot(page, "watermark-action-bar");

      await play(page);
      await page.locator("video").evaluate((v: HTMLVideoElement) => {
        v.currentTime = v.duration - 0.15;
      });
      const email = page.locator('input[type="email"]');
      await shownInFullscreen(email);
      await shot(page, "email-gate");
      await email.fill("viewer@example.com");
      await page.getByRole("button", { name: "Skip" }).click();
      await shownInFullscreen(page.locator(".playerstack-cta-button"));
      await shot(page, "cta-end");

      await page.evaluate(() => document.exitFullscreen());
      await expect.poll(() => fullscreenTag(page)).toBeNull();
      await expect.poll(() => page.locator("player-stack").boundingBox()).toEqual(inline);
    });

    test("default watermark leaves every control clickable", async ({ page }) => {
      await open(page, { watermark });
      await enter(page);
      await page.locator("media-fullscreen-button").click({ timeout: 5000 });
      await expect.poll(() => fullscreenTag(page)).toBeNull();
    });

    for (const position of ["bottom-left", "bottom-right"]) {
      test(`${position} linked watermark sits above the control bar and opens its link`, async ({
        page,
      }) => {
        await open(page, {
          watermark: { ...watermark, position, href: "https://example.com/brand" },
          actionBar: { enabled: true, position: "bottom", title: "Course", button: cta.button },
        });
        const mark = page.locator(".playerstack-watermark");
        for (const full of [false, true]) {
          if (full) await enter(page);
          const bar = (await page.locator("media-control-bar").boundingBox())!;
          await expect
            .poll(async () => {
              const box = (await mark.boundingBox())!;
              return box.y + box.height <= bar.y;
            })
            .toBe(true);
          const offer = (await page.locator(".playerstack-action-bar-button").boundingBox())!;
          await expect
            .poll(async () => (await mark.boundingBox())!.y >= offer.y + offer.height)
            .toBe(true);
          for (const control of ["media-play-button", "media-fullscreen-button"]) {
            await page.locator(control).click({ trial: true, timeout: 5000 });
          }
        }
        await page.locator(".playerstack-action-bar-close").click();
        const popup = page.waitForEvent("popup");
        await mark.click();
        await (await popup).close();
      });
    }

    test("sticky never pins a fullscreen player and pins again after exit", async ({ page }) => {
      await open(page, { sticky: { enabled: true } });
      const player = page.locator("player-stack");
      await play(page);
      await page.evaluate(() => scrollTo(0, 1500));
      await expect(player).toHaveClass(/playerstack-sticky/);
      await enter(page);
      await expect(player).not.toHaveClass(/playerstack-sticky/);
      await expect(page.locator(".playerstack-sticky-close")).toHaveCount(0);
      await page.locator("media-fullscreen-button").click();
      await expect.poll(() => fullscreenTag(page)).toBeNull();
      await page.evaluate(() => scrollTo(0, 1500));
      await expect(player).toHaveClass(/playerstack-sticky/);
    });
  });
}
