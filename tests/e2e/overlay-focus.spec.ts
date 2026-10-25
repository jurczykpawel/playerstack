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
  longCard?: "cta" | "intro:fullscreen" | "intro:center" | "intro:bottom",
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
    if (url.pathname === "/demo.mp4") {
      const range = route.request().headers()["range"];
      const match = range?.match(/^bytes=(\d*)-(\d*)$/);
      const start = match
        ? match[1]
          ? Number(match[1])
          : Math.max(0, mp4.length - Number(match[2]))
        : 0;
      const end =
        match?.[1] && match[2] ? Math.min(Number(match[2]), mp4.length - 1) : mp4.length - 1;
      if (start > end || start >= mp4.length)
        return route.fulfill({
          status: 416,
          headers: { "Content-Range": `bytes */${mp4.length}` },
        });
      const body = mp4.subarray(start, end + 1);
      return route.fulfill({
        status: match ? 206 : 200,
        body,
        contentType: "video/mp4",
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": String(body.length),
          ...(match ? { "Content-Range": `bytes ${start}-${end}/${mp4.length}` } : {}),
        },
      });
    }
    if (url.pathname.startsWith("/assets/"))
      return route.fulfill({
        body: readFileSync(resolve(dist, url.pathname.split("/").pop()!)),
        contentType: "application/javascript",
      });
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html lang="en"><meta charset="utf-8"><style>body{margin:16px}player-stack{display:block;width:min(100%,720px);aspect-ratio:16/9}</style><button id="before">Before</button><player-stack src="${origin}/demo.mp4" data-config='${JSON.stringify({ preload: "none", brandedThumb: { enabled: true, clickToLoad: true, playLabel: "Watch demo" }, ctaEnd: { enabled: cta, button: { label: "Offer", url: "https://example.com" }, showReplay: true, ...(longCard === "cta" ? { title: "End card details ".repeat(30), html: `<p>${"More information about this video. ".repeat(40)}</p>` } : {}) }, ...(email ? { emailGate: { enabled: true, at: email, dismissible: true, remember: false, product: "Demo", webhookUrl: `${origin}/lead`, challengeUrl: `${origin}/challenge`, ...(consentMode ? { marketingConsent: { text: "Chcę otrzymywać wiadomości o nowych materiałach.", version: "2026-10", required: consentMode === "required" }, privacy: { text: "Kontakt w sprawie podobnego rozwiązania." } } : {}), ...(localized ? { privacy: { text: "Zostaw maila, a odezwę się w sprawie podobnego rozwiązania.", linkText: "Polityka prywatności", href: "/privacy" }, messages: { title: "Chcesz coś takiego u siebie? Zostaw maila", emailLabel: "Adres e-mail", submit: "Wyślij zgłoszenie", dismiss: "Pomiń" } } : {}) } } : {}), ...(intro ? { introCard: { enabled: true, dismissible: true, title: longCard?.startsWith("intro:") ? "Welcome to this introduction ".repeat(25) : "Welcome", ...(longCard?.startsWith("intro:") ? { subtitle: "Read these details before watching. ".repeat(40), position: longCard.slice(6) } : {}) } } : {}) })}'></player-stack><button id="after">After</button><script src="/assets/playerstack.min.js"></script></html>`,
    });
  });
  await page.goto(origin);
  await expect(page.locator(".playerstack-thumb-play")).toBeAttached();
  if (email === "before") await expect(page.locator(".playerstack-email-gate")).toBeVisible();
  if (intro) await expect(page.locator(".playerstack-intro-card")).toBeVisible();
}
async function press(page: Page, key: string) {
  // Option+Tab includes links in WebKit's macOS keyboard navigation.
  const webkit = test.info().project.name === "webkit";
  await page.keyboard.press(
    webkit && key === "Tab" ? "Alt+Tab" : webkit && key === "Shift+Tab" ? "Alt+Shift+Tab" : key,
  );
}
async function visibleHit(target: Locator) {
  let geometry: unknown;
  try {
    await expect
      .poll(
        async () => {
          const result = await target.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const point = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            const hit = document.elementFromPoint(point.x, point.y);
            const box = (node: Element | null | undefined) => {
              if (!(node instanceof HTMLElement)) return null;
              const rect = node.getBoundingClientRect();
              const css = getComputedStyle(node);
              return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                clientHeight: node.clientHeight,
                scrollHeight: node.scrollHeight,
                scrollTop: node.scrollTop,
                overflowY: css.overflowY,
                alignItems: css.alignItems,
                justifyContent: css.justifyContent,
              };
            };
            const overlay = el.closest(
              ".playerstack-email-gate,.playerstack-cta,.playerstack-intro-card",
            );
            return {
              visible: !!hit && (hit === el || el.contains(hit)),
              point,
              hit: hit ? { tag: hit.tagName, id: hit.id, class: hit.getAttribute("class") } : null,
              target: box(el),
              player: box(el.closest("player-stack")),
              overlay: box(overlay),
              content: box(
                el.closest("form") || overlay?.querySelector(".playerstack-intro-card-content"),
              ),
            };
          });
          geometry = result;
          return result.visible;
        },
        { timeout: 1000 },
      )
      .toBe(true);
  } catch (error) {
    await test.info().attach("focus-geometry", {
      body: JSON.stringify(geometry ?? null, null, 2),
      contentType: "application/json",
    });
    throw error;
  }
}
async function visibleFocus(target: Locator) {
  await expect(target).toBeFocused();
  await visibleHit(target);
  expect(await target.evaluate((el) => el.closest("player-stack")?.scrollTop ?? 0)).toBe(0);
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
      await press(page, "Tab");
      await visibleFocus(page.locator(".playerstack-thumb-play"));
      await press(page, "Tab");
      await visibleFocus(page.locator("#after"));
      await press(page, "Shift+Tab");
      await visibleFocus(page.locator(".playerstack-thumb-play"));
      await press(page, "Enter");
      await expect(page.locator("media-play-button")).toBeFocused();
      await end(page);
      // Continue to Tab assertions when checking an older build without focus transfer.
      await expect.soft(page.locator(".playerstack-cta-button")).toBeFocused();
      await page.locator("#before").focus();
      for (const selector of [".playerstack-cta-button", ".playerstack-cta-replay", "#after"]) {
        await press(page, "Tab");
        await visibleFocus(page.locator(selector));
      }
      for (const selector of [".playerstack-cta-replay", ".playerstack-cta-button", "#before"]) {
        await press(page, "Shift+Tab");
        await visibleFocus(page.locator(selector));
      }
      await press(page, "Tab");
      await press(page, "Tab");
      await press(page, "Enter");
      await expect(page.locator(".playerstack-cta")).toHaveCount(0);
      await expect(page.locator("media-play-button")).toBeFocused();
      await expect
        .poll(() =>
          page.locator("video").evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime < 3),
        )
        .toBe(true);
    });
    for (const card of ["cta", "intro:fullscreen", "intro:center", "intro:bottom"] as const) {
      test(`long ${card} is scrollable by pointer and keyboard without moving the player`, async ({
        page,
      }) => {
        const intro = card !== "cta";
        await open(page, intro, undefined, !intro, false, undefined, card);
        if (!intro) {
          await page.locator(".playerstack-thumb-play").focus();
          await press(page, "Enter");
          await end(page);
        }
        const player = page.locator("player-stack");
        const overlay = page.locator(intro ? ".playerstack-intro-card" : ".playerstack-cta");
        await expect(overlay).toHaveCSS("overflow-y", "auto");
        await expect
          .poll(() => overlay.evaluate((el) => el.scrollHeight > el.clientHeight))
          .toBe(true);
        await player.evaluate((el) => {
          const root = el as HTMLElement & { nonzeroScrolls: number[] };
          root.nonzeroScrolls = [];
          root.addEventListener("scroll", () => {
            if (root.scrollTop !== 0) root.nonzeroScrolls.push(root.scrollTop);
          });
        });
        expect(await player.evaluate((el) => el.scrollTop)).toBe(0);
        const actions = intro
          ? [
              page.locator(".playerstack-intro-card-close"),
              page.locator(".playerstack-intro-card-play"),
            ]
          : [page.locator(".playerstack-cta-button"), page.locator(".playerstack-cta-replay")];
        await page.locator("#before").focus();
        await overlay.evaluate((el) => {
          el.scrollTop = 0;
        });
        if (intro) await visibleHit(actions[0]!);
        await overlay.hover();
        await page.mouse.wheel(0, await overlay.evaluate((el) => el.scrollHeight));
        await expect.poll(() => overlay.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
        if (!intro) await visibleHit(actions[0]!);
        await visibleHit(actions[1]!);
        expect(await player.evaluate((el) => el.scrollTop)).toBe(0);
        await page.locator("#before").focus();
        for (const target of [...actions, page.locator("#after")]) {
          await press(page, "Tab");
          await visibleFocus(target);
        }
        for (const target of [...actions].reverse().concat(page.locator("#before"))) {
          await press(page, "Shift+Tab");
          await visibleFocus(target);
        }
        expect(
          await player.evaluate(
            (el) => (el as HTMLElement & { nonzeroScrolls: number[] }).nonzeroScrolls,
          ),
        ).toEqual([]);
        await actions[intro ? 0 : 1]!.click();
        await expect(overlay).toHaveCount(0);
        expect(await player.evaluate((el) => el.scrollTop)).toBe(0);
      });
    }
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
      await press(page, "Enter");
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
        await press(page, "Tab");
        await visibleFocus(target);
      }
      for (const target of [
        page.getByRole("button", { name: "Skip" }),
        page.locator('button[type="submit"]'),
        email,
        page.locator("#before"),
      ]) {
        await press(page, "Shift+Tab");
        await visibleFocus(target);
      }
      await press(page, "Tab");
      await press(page, "Escape");
      await expect(page.locator(".playerstack-email-gate")).toHaveCount(0);
      await visibleFocus(page.locator("media-play-button"));
    });
    test("Polish contact form keeps privacy and actions visible to keyboard users", async ({
      page,
    }) => {
      await open(page, false, "after", false, true);
      await page.locator(".playerstack-thumb-play").focus();
      await press(page, "Enter");
      await end(page);
      await visibleFocus(page.getByRole("textbox", { name: "Adres e-mail" }));
      for (const target of [
        page.getByRole("link", { name: "Polityka prywatności" }),
        page.getByRole("button", { name: "Wyślij zgłoszenie" }),
        page.getByRole("button", { name: "Pomiń" }),
        page.locator("#after"),
      ]) {
        await press(page, "Tab");
        await visibleFocus(target);
      }
      await press(page, "Shift+Tab");
      await press(page, "Escape");
      await visibleFocus(page.locator("media-play-button"));
    });
    test("optional consent has visible Tab stops and Space changes its selection", async ({
      page,
    }) => {
      await open(page, false, "after", false, false, "optional");
      await page.locator(".playerstack-thumb-play").focus();
      await press(page, "Enter");
      await end(page);
      const player = page.locator("player-stack");
      const overlay = page.locator(".playerstack-email-gate");
      await player.evaluate((el) => {
        const root = el as HTMLElement & { nonzeroScrolls: number[] };
        root.nonzeroScrolls = [];
        root.addEventListener("scroll", () => {
          if (root.scrollTop !== 0) root.nonzeroScrolls.push(root.scrollTop);
        });
      });
      expect(await player.evaluate((el) => el.scrollTop)).toBe(0);
      await expect(overlay).toHaveCSS("overflow-y", "auto");
      const overflows = await overlay.evaluate((el) => el.scrollHeight > el.clientHeight);
      await page.locator("#before").focus();
      if (overflows) {
        await overlay.hover();
        await page.mouse.wheel(0, await overlay.evaluate((el) => el.scrollHeight));
        await expect.poll(() => overlay.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      }
      await visibleHit(page.locator('button[type="submit"]'));
      await visibleHit(page.getByRole("button", { name: "Skip", exact: true }));
      expect(await player.evaluate((el) => el.scrollTop)).toBe(0);
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
        await press(page, "Tab");
        await visibleFocus(target);
        if (await target.evaluate((el) => el.matches('input[type="checkbox"]'))) {
          await press(page, "Space");
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
        await press(page, "Shift+Tab");
        await visibleFocus(target);
      }
      expect(
        await player.evaluate(
          (el) => (el as HTMLElement & { nonzeroScrolls: number[] }).nonzeroScrolls,
        ),
      ).toEqual([]);
      await overlay.hover();
      if (overflows) await page.mouse.wheel(0, await overlay.evaluate((el) => el.scrollHeight));
      await visibleHit(page.getByRole("button", { name: "Skip", exact: true }));
      await page.getByRole("button", { name: "Skip", exact: true }).click();
      await expect(overlay).toHaveCount(0);
      expect(await player.evaluate((el) => el.scrollTop)).toBe(0);
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
      await press(page, "Enter");
      await end(page);
      await page.locator('input[type="email"]').fill("viewer@example.com");
      await press(page, "Tab");
      await press(page, "Tab");
      await press(page, "Enter");
      const consent = page.getByRole("checkbox");
      await visibleFocus(consent);
      await expect(consent).toHaveAttribute("aria-invalid", "true");
      expect(requests).toEqual([]);
      await press(page, "Space");
      await expect(consent).toBeChecked();
      await expect(consent).not.toHaveAttribute("aria-invalid");
      await press(page, "Tab");
      await press(page, "Enter");
      await expect(page.locator(".playerstack-email-gate")).toHaveCount(0);
      expect(requests).toHaveLength(2);
      await visibleFocus(page.locator("media-play-button"));
    });
    test("email after submission exposes the remaining CTA and Enter replays", async ({ page }) => {
      await open(page, false, "after");
      await page.locator(".playerstack-thumb-play").focus();
      await press(page, "Enter");
      await end(page);
      await visibleFocus(page.locator('input[type="email"]'));
      await page.locator('input[type="email"]').fill("viewer@example.com");
      await press(page, "Tab");
      await press(page, "Enter");
      await expect(page.locator(".playerstack-email-gate")).toHaveCount(0);
      await visibleFocus(page.locator(".playerstack-cta-button"));
      await press(page, "Tab");
      await visibleFocus(page.locator(".playerstack-cta-replay"));
      await press(page, "Enter");
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
      await press(page, "Shift+Tab");
      await visibleFocus(page.getByRole("button", { name: "Skip" }));
      await press(page, "Enter");
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
        await press(page, "Tab");
        await visibleFocus(target);
      }
      await press(page, "Shift+Tab");
      await press(page, "Enter");
      await visibleFocus(page.locator(".playerstack-thumb-play"));
      await press(page, "Tab");
      await visibleFocus(page.locator("#after"));
    });
    test("intro card covers thumbnail and dismissal restores it", async ({ page }) => {
      await open(page, true);
      await page.locator("#before").focus();
      await press(page, "Tab");
      await visibleFocus(page.locator(".playerstack-intro-card-close"));
      await press(page, "Tab");
      await visibleFocus(page.locator(".playerstack-intro-card-play"));
      await press(page, "Tab");
      await visibleFocus(page.locator("#after"));
      await press(page, "Shift+Tab");
      await visibleFocus(page.locator(".playerstack-intro-card-play"));
      await press(page, "Shift+Tab");
      await press(page, "Enter");
      await visibleFocus(page.locator(".playerstack-thumb-play"));
      await press(page, "Tab");
      await visibleFocus(page.locator("#after"));
    });
  });
}
