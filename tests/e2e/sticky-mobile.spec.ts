import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openEmbed, observeStandalone } from "./standalone-helpers";

// The pinned player on narrow and wide screens, on the built standalone script.
observeStandalone();

const SRC = "https://demo.local/demo.mp4";
const shots = process.env.STICKY_SHOTS;
const mp4 = readFileSync(resolve("apps/docs/public/demo.mp4"));
const PINNED = "player-stack.playerstack-sticky";
const button = { label: "Zapisuję się", url: "https://example.com" };
const ctaEnd = {
  enabled: true,
  title: "Dzięki za obejrzenie!",
  html: "<p>Zapisz się na webinar i odbierz bonus.</p>",
  button,
  showReplay: true,
};
const emailGate = {
  enabled: true,
  at: 2,
  remember: false,
  dismissible: true,
  title: "Odbierz bonus",
  privacy: { text: "Administratorem danych jest organizator webinaru." },
  marketingConsent: { text: "Chcę dostawać informacje o kolejnych lekcjach.", version: "1" },
};
const actionBar = { enabled: true, showAt: "start", title: "Webinar w czwartek", button };

async function open(page: Page, config: Record<string, unknown>, style: string | null = null) {
  await page.route(SRC, (route) => {
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
  });
  await openEmbed(page, SRC, { sticky: { enabled: true }, ...config });
  await expect(page.locator("player-stack video")).toHaveAttribute("src", SRC);
  await page.locator("player-stack").evaluate((el, value) => {
    if (value === null) el.removeAttribute("style");
    else el.setAttribute("style", value);
    document.body.style.margin = "0";
    const text = document.createElement("div");
    text.style.height = "300vh";
    document.body.append(text);
  }, style);
}

async function pin(page: Page) {
  await page.locator("player-stack video").evaluate(async (el: HTMLVideoElement) => {
    el.muted = true;
    await el.play();
  });
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect(page.locator(PINNED)).toBeVisible();
}

const seek = (page: Page, time: number) =>
  page.locator("player-stack video").evaluate((el: HTMLVideoElement, value) => {
    el.currentTime = value;
  }, time);

const box = (page: Page) =>
  page.locator("player-stack").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const view = document.documentElement;
    return {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      right: Math.round(view.clientWidth - rect.right),
      bottom: Math.round(view.clientHeight - rect.bottom),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });

/** True when a tap on the element's centre reaches it, with no scrolling first. */
const reachable = (target: Locator) =>
  target.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const player = el.closest("player-stack")!.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const inside =
      rect.top >= player.top - 0.5 &&
      rect.bottom <= player.bottom + 0.5 &&
      rect.left >= player.left - 0.5 &&
      rect.right <= player.right + 0.5;
    const hit = document.elementFromPoint(x, y);
    return inside && !!hit && (hit === el || el.contains(hit));
  });

async function tap(page: Page, target: Locator) {
  const rect = (await target.boundingBox())!;
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

async function expectUsableClose(page: Page) {
  const close = page.locator(".playerstack-sticky-close");
  const rect = (await close.boundingBox())!;
  expect(rect.width).toBeGreaterThanOrEqual(44);
  expect(rect.height).toBeGreaterThanOrEqual(44);
  await expect(close).not.toHaveAttribute("inert");
  await expect(close).not.toHaveAttribute("aria-hidden");
  await expect.poll(() => reachable(close)).toBe(true);
}

async function dismissPin(page: Page) {
  const before = await scrollY(page);
  await tap(page, page.locator(".playerstack-sticky-close"));
  await expect(page.locator(PINNED)).toHaveCount(0);
  await expect(page.locator(".playerstack-sticky-close")).toHaveCount(0);
  expect(await scrollY(page)).toBe(before);
}

async function shot(page: Page, name: string) {
  if (!shots) return;
  const project = test.info().project.name;
  await page.screenshot({ path: `${shots}/${project}-${page.viewportSize()!.width}-${name}.png` });
}

for (const [width, height] of [
  [390, 844],
  [1440, 900],
] as const) {
  const narrow = width < 600;

  test.describe(`${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test("pins at the expected size, keeps playing after close and stays unpinned", async ({
      page,
    }) => {
      await open(page, {});
      await pin(page);
      await expect
        .poll(() => box(page))
        .toMatchObject(
          narrow
            ? { left: 8, right: 8, bottom: 8, width: 374, height: 210 }
            : { right: 16, bottom: 16, width: 360, height: 203 },
        );
      expect(await scrollY(page)).toBe(1400);
      await expectUsableClose(page);
      await shot(page, "1-pinned");
      await dismissPin(page);
      const video = page.locator("player-stack video");
      const time = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
      await expect
        .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
        .toBeGreaterThan(time + 0.3);
      for (const y of [0, 1400]) {
        await page.evaluate((value) => window.scrollTo(0, value), y);
        await page.evaluate(
          () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
        );
      }
      await page.waitForTimeout(300);
      await expect(page.locator(PINNED)).toHaveCount(0);
    });

    test("shows the whole end card with a clickable button and close", async ({ page }) => {
      await open(page, { ctaEnd });
      await pin(page);
      await seek(page, 11.7);
      const card = page.locator(".playerstack-cta");
      await expect(card).toBeVisible();
      await shot(page, "2-end-card");
      for (const part of [".playerstack-cta-button", ".playerstack-cta-replay"])
        await expect.poll(() => reachable(page.locator(part))).toBe(true);
      await expectUsableClose(page);
      expect(await scrollY(page)).toBe(1400);
      const popup = page.context().waitForEvent("page");
      await page.context().route("https://example.com/**", (r) => r.fulfill({ body: "ok" }));
      await tap(page, page.locator(".playerstack-cta-button"));
      await (await popup).close();
      await dismissPin(page);
      await expect(card).toHaveCount(1);
    });

    test("fits the e-mail form with consent and keeps close above it", async ({ page }) => {
      await open(page, { emailGate });
      await pin(page);
      await seek(page, 2.5);
      const gate = page.locator(".playerstack-email-gate");
      await expect(gate).toBeVisible();
      await shot(page, "5-email-gate");
      await expect.poll(async () => (await box(page)).height).toBe(420);
      expect((await box(page)).width).toBe(narrow ? 374 : 360);
      for (const part of ["input[type=email]", "button[type=submit]", "button[type=button]"])
        await expect.poll(() => reachable(gate.locator(part))).toBe(true);
      await expectUsableClose(page);
      expect(await scrollY(page)).toBe(1400);
      await tap(page, gate.locator("input[type=email]"));
      await page.keyboard.type("viewer@example.com");
      await tap(page, gate.locator("button[type=submit]"));
      await expect(gate).toHaveCount(0);
      await expect.poll(async () => (await box(page)).height).toBe(narrow ? 210 : 203);
      expect(await scrollY(page)).toBe(1400);
    });

    test("closes the pin over an open e-mail form", async ({ page }) => {
      await open(page, { emailGate });
      await pin(page);
      await seek(page, 2.5);
      await expect(page.locator(".playerstack-email-gate")).toBeVisible();
      await expectUsableClose(page);
      await dismissPin(page);
      await expect(page.locator(".playerstack-email-gate")).toHaveCount(1);
    });

    for (const [name, extra] of [
      ["bottom bar", {}],
      ["top bar", { position: "top" }],
    ] as const) {
      test(`keeps the ${name} and both close buttons clickable`, async ({ page }) => {
        await open(page, { actionBar: { ...actionBar, ...extra } });
        await pin(page);
        const bar = page.locator(".playerstack-action-bar");
        await expect(bar).toBeVisible();
        await shot(page, `3-${name.replace(" ", "-")}`);
        await expect.poll(() => reachable(bar.locator("a"))).toBe(true);
        await expect.poll(() => reachable(bar.locator("button"))).toBe(true);
        await expectUsableClose(page);
        await tap(page, bar.locator("button"));
        await expect(bar).toHaveCount(0);
        await expect(page.locator(PINNED)).toHaveCount(1);
      });
    }

    test("keeps the intro card close button clear of the pin close button", async ({ page }) => {
      await open(page, {});
      await pin(page);
      // An intro card is up before playback, so mount its close button on the pinned player.
      await page.locator("player-stack").evaluate((el) => {
        const card = document.createElement("div");
        card.className = "playerstack-intro-card";
        card.style.cssText = "position:absolute;inset:0;z-index:3";
        const close = document.createElement("button");
        close.className = "playerstack-intro-card-close";
        close.style.cssText = "position:absolute;top:12px;right:12px;width:36px;height:36px";
        card.append(close);
        el.append(card);
      });
      await expect.poll(() => reachable(page.locator(".playerstack-intro-card-close"))).toBe(true);
      await expectUsableClose(page);
    });
  });
}

for (const [width, inline] of [
  [390, "display:block;width:640px;height:360px"],
  [390, "display:block;width:640px;min-width:640px;margin:0 40px"],
  [700, "display:block;width:900px"],
] as const) {
  test(`keeps the pinned player on a ${width} px screen with ${inline}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page, {}, inline);
    await pin(page);
    await expect.poll(async () => (await box(page)).left).toBeGreaterThanOrEqual(0);
    const pinned = await box(page);
    expect(pinned.right).toBeGreaterThanOrEqual(0);
    expect(pinned.top).toBeGreaterThanOrEqual(0);
    expect(pinned.bottom).toBeGreaterThanOrEqual(0);
    if (width < 600) expect(pinned).toMatchObject({ left: 8, right: 8, height: 210 });
    await expectUsableClose(page);
  });
}

test("uses the configured offset as the bottom gap on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, { sticky: { enabled: true, position: "top-left", offset: 72 } });
  await pin(page);
  await expect.poll(() => box(page)).toMatchObject({ left: 8, right: 8, bottom: 72, height: 210 });
});

test("grows to at most 60% of a short narrow screen under an overlay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await open(page, { ctaEnd });
  await pin(page);
  await seek(page, 11.7);
  await expect(page.locator(".playerstack-cta")).toBeVisible();
  await expect.poll(async () => (await box(page)).height).toBe(360);
  await expect.poll(() => reachable(page.locator(".playerstack-cta-button"))).toBe(true);
  await expectUsableClose(page);
});

for (const [width, expected] of [
  [599, 583],
  [600, 240],
] as const) {
  test(`switches layout at the ${width} px breakpoint`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page, {});
    await pin(page);
    await expect.poll(async () => (await box(page)).width).toBe(expected);
  });
}
