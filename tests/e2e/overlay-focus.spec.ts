import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const origin = "http://127.0.0.1:15184";
const dist = process.env.PLAYERSTACK_DIST || resolve("packages/embed/dist");
const mp4 = readFileSync(resolve("apps/docs/public/demo.mp4"));
async function open(
  page: Page,
  intro = false,
  email?: "before" | "after",
  cta = true,
  localized = false,
  consentMode?: "optional" | "required",
) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) throw new Error(`Unexpected external request: ${url}`);
    if (url.pathname === "/challenge")
      return route.fulfill({
        json: {
          altcha: {
            algorithm: "SHA-256",
            challenge: "590c9f8430c7435807df8ba9a476e3f1295d46ef210f6efae2043a4c085a569e",
            salt: "test",
            signature: "test",
            maxnumber: 0,
          },
          nonce: "test-nonce",
        },
      });
    if (url.pathname === "/lead") {
      const payload = route.request().postDataJSON();
      expect(payload).toMatchObject({
        email: "viewer@example.com",
        product: "Demo",
        nonce: "test-nonce",
        altcha: { number: 0 },
      });
      if (consentMode)
        expect(payload).toMatchObject({
          marketingConsent: true,
          consentVersion: "2026-10",
          consentText: "Chcę otrzymywać wiadomości o nowych materiałach.",
        });
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === "/demo.mp4") return route.fulfill({ body: mp4, contentType: "video/mp4" });
    if (url.pathname.startsWith("/assets/"))
      return route.fulfill({
        body: readFileSync(resolve(dist, url.pathname.split("/").pop()!)),
        contentType: "application/javascript",
      });
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><style>body{margin:16px}player-stack{display:block;width:min(100%,720px);aspect-ratio:16/9}</style><button id="before">Before</button><player-stack src="${origin}/demo.mp4" data-config='${JSON.stringify({ preload: "none", brandedThumb: { enabled: true, clickToLoad: true, playLabel: "Watch demo" }, ctaEnd: { enabled: cta, button: { label: "Offer", url: "https://example.com" }, showReplay: true }, ...(email ? { emailGate: { enabled: true, at: email, dismissible: true, remember: false, product: "Demo", webhookUrl: `${origin}/lead`, challengeUrl: `${origin}/challenge`, ...(consentMode ? { marketingConsent: { text: "Chcę otrzymywać wiadomości o nowych materiałach.", version: "2026-10", required: consentMode === "required" }, privacy: { text: "Kontakt w sprawie podobnego rozwiązania." } } : {}), ...(localized ? { privacy: { text: "Zostaw maila, a odezwę się w sprawie podobnego rozwiązania.", linkText: "Polityka prywatności", href: "/privacy" }, messages: { title: "Chcesz coś takiego u siebie? Zostaw maila", emailLabel: "Adres e-mail", submit: "Wyślij zgłoszenie", dismiss: "Pomiń" } } : {}) } } : {}), ...(intro ? { introCard: { enabled: true, dismissible: true, title: "Welcome" } } : {}) })}'></player-stack><button id="after">After</button><script src="/assets/playerstack.min.js"></script></html>`,
    });
  });
  await page.goto(origin);
  await expect(page.locator(".playerstack-thumb-play")).toBeAttached();
  if (email === "before") await expect(page.locator(".playerstack-email-gate")).toBeVisible();
  if (intro) await expect(page.locator(".playerstack-intro-card")).toBeVisible();
}
async function visibleFocus(target: Locator) {
  await expect(target).toBeFocused();
  expect(
    await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!hit && (hit === el || el.contains(hit));
    }),
  ).toBe(true);
}
async function end(page: Page) {
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0),
    )
    .toBe(true);
  await page.locator("video").evaluate((v: HTMLVideoElement) => {
    v.currentTime = v.duration - 0.15;
  });
  await expect(page.locator(".playerstack-cta,.playerstack-email-gate").first()).toBeVisible();
}
for (const width of [390, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("CTA has only visible forward and reverse Tab stops and replays with Enter", async ({
      page,
    }) => {
      await open(page);
      await page.locator("#before").focus();
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator(".playerstack-thumb-play"));
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator("#after"));
      await page.keyboard.press("Shift+Tab");
      await visibleFocus(page.locator(".playerstack-thumb-play"));
      await page.keyboard.press("Enter");
      await expect(page.locator("media-play-button")).toBeFocused();
      await end(page);
      await visibleFocus(page.locator(".playerstack-cta-button"));
      await page.locator("#before").focus();
      for (const selector of [".playerstack-cta-button", ".playerstack-cta-replay", "#after"]) {
        await page.keyboard.press("Tab");
        await visibleFocus(page.locator(selector));
      }
      for (const selector of [".playerstack-cta-replay", ".playerstack-cta-button", "#before"]) {
        await page.keyboard.press("Shift+Tab");
        await visibleFocus(page.locator(selector));
      }
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await expect(page.locator(".playerstack-cta")).toHaveCount(0);
      await expect(page.locator("media-play-button")).toBeFocused();
      await expect
        .poll(() =>
          page.locator("video").evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime < 3),
        )
        .toBe(true);
    });
    test("ending leaves external focus alone", async ({ page }) => {
      await open(page);
      await page.locator(".playerstack-thumb-play").click();
      await page.locator("#after").focus();
      await end(page);
      await expect(page.locator("#after")).toBeFocused();
    });
    test("email after has only visible forward and reverse Tab stops and Escape restores play", async ({
      page,
    }) => {
      await open(page, false, "after", false);
      await page.locator(".playerstack-thumb-play").focus();
      await page.keyboard.press("Enter");
      await end(page);
      const email = page.locator('input[type="email"]');
      await visibleFocus(email);
      await page.locator("#before").focus();
      for (const target of [
        email,
        page.locator('button[type="submit"]'),
        page.getByRole("button", { name: "Skip" }),
        page.locator("#after"),
      ]) {
        await page.keyboard.press("Tab");
        await visibleFocus(target);
      }
      for (const target of [
        page.getByRole("button", { name: "Skip" }),
        page.locator('button[type="submit"]'),
        email,
        page.locator("#before"),
      ]) {
        await page.keyboard.press("Shift+Tab");
        await visibleFocus(target);
      }
      await page.keyboard.press("Tab");
      await page.keyboard.press("Escape");
      await expect(page.locator(".playerstack-email-gate")).toHaveCount(0);
      await visibleFocus(page.locator("media-play-button"));
    });
    test("Polish contact form keeps privacy and actions visible to keyboard users", async ({
      page,
    }) => {
      await open(page, false, "after", false, true);
      await page.locator(".playerstack-thumb-play").focus();
      await page.keyboard.press("Enter");
      await end(page);
      await visibleFocus(page.getByRole("textbox", { name: "Adres e-mail" }));
      for (const target of [
        page.getByRole("link", { name: "Polityka prywatności" }),
        page.getByRole("button", { name: "Wyślij zgłoszenie" }),
        page.getByRole("button", { name: "Pomiń" }),
        page.locator("#after"),
      ]) {
        await page.keyboard.press("Tab");
        await visibleFocus(target);
      }
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Escape");
      await visibleFocus(page.locator("media-play-button"));
    });
    test("optional consent has visible Tab stops and Space changes its selection", async ({
      page,
    }) => {
      await open(page, false, "after", false, false, "optional");
      await page.locator(".playerstack-thumb-play").focus();
      await page.keyboard.press("Enter");
      await end(page);
      const consent = page.getByRole("checkbox");
      await expect(consent).not.toBeChecked();
      await page.locator("#before").focus();
      for (const target of [
        page.locator('input[type="email"]'),
        consent,
        page.locator('button[type="submit"]'),
        page.getByRole("button", { name: "Skip", exact: true }),
        page.locator("#after"),
      ]) {
        await page.keyboard.press("Tab");
        await visibleFocus(target);
        if (await target.evaluate((el) => el.matches('input[type="checkbox"]'))) {
          await page.keyboard.press("Space");
          await expect(consent).toBeChecked();
        }
      }
      for (const target of [
        page.getByRole("button", { name: "Skip", exact: true }),
        page.locator('button[type="submit"]'),
        consent,
        page.locator('input[type="email"]'),
        page.locator("#before"),
      ]) {
        await page.keyboard.press("Shift+Tab");
        await visibleFocus(target);
      }
    });
    test("required consent blocks requests and focuses checkbox until Space accepts it", async ({
      page,
    }) => {
      const requests: string[] = [];
      page.on("request", (request) => {
        if (/\/(challenge|lead)(\?|$)/.test(request.url())) requests.push(request.url());
      });
      await open(page, false, "after", false, false, "required");
      await page.locator(".playerstack-thumb-play").focus();
      await page.keyboard.press("Enter");
      await end(page);
      await page.locator('input[type="email"]').fill("viewer@example.com");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      const consent = page.getByRole("checkbox");
      await visibleFocus(consent);
      await expect(consent).toHaveAttribute("aria-invalid", "true");
      expect(requests).toEqual([]);
      await page.keyboard.press("Space");
      await expect(consent).toBeChecked();
      await expect(consent).not.toHaveAttribute("aria-invalid");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await expect(page.locator(".playerstack-email-gate")).toHaveCount(0);
      expect(requests).toHaveLength(2);
      await visibleFocus(page.locator("media-play-button"));
    });
    test("email after submission exposes the remaining CTA and Enter replays", async ({ page }) => {
      await open(page, false, "after");
      await page.locator(".playerstack-thumb-play").focus();
      await page.keyboard.press("Enter");
      await end(page);
      await visibleFocus(page.locator('input[type="email"]'));
      await page.locator('input[type="email"]').fill("viewer@example.com");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await expect(page.locator(".playerstack-email-gate")).toHaveCount(0);
      await visibleFocus(page.locator(".playerstack-cta-button"));
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator(".playerstack-cta-replay"));
      await page.keyboard.press("Enter");
      await visibleFocus(page.locator("media-play-button"));
    });
    test("email after skip exposes CTA and preserves external focus on ending", async ({
      page,
    }) => {
      await open(page, false, "after");
      await page.locator(".playerstack-thumb-play").click();
      await page.locator("#after").focus();
      await end(page);
      await visibleFocus(page.locator("#after"));
      await page.keyboard.press("Shift+Tab");
      await visibleFocus(page.getByRole("button", { name: "Skip" }));
      await page.keyboard.press("Enter");
      await visibleFocus(page.locator(".playerstack-cta-button"));
    });
    test("email before covers thumbnail and dismissal restores its focus", async ({ page }) => {
      await open(page, false, "before", false);
      await page.locator("#before").focus();
      for (const target of [
        page.locator('input[type="email"]'),
        page.locator('button[type="submit"]'),
        page.getByRole("button", { name: "Skip" }),
        page.locator("#after"),
      ]) {
        await page.keyboard.press("Tab");
        await visibleFocus(target);
      }
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Enter");
      await visibleFocus(page.locator(".playerstack-thumb-play"));
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator("#after"));
    });
    test("intro card covers thumbnail and dismissal restores it", async ({ page }) => {
      await open(page, true);
      await page.locator("#before").focus();
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator(".playerstack-intro-card-close"));
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator(".playerstack-intro-card-play"));
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator("#after"));
      await page.keyboard.press("Shift+Tab");
      await visibleFocus(page.locator(".playerstack-intro-card-play"));
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Enter");
      await visibleFocus(page.locator(".playerstack-thumb-play"));
      await page.keyboard.press("Tab");
      await visibleFocus(page.locator("#after"));
    });
  });
}
