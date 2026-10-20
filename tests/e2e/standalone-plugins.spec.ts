import { test, expect } from "@playwright/test";
import { SOURCES, openEmbed, lazyFiles, observeStandalone } from "./standalone-helpers";

observeStandalone();

test("configured CTA downloads only cta-end and renders when playback ends", async ({ page }) => {
  const fetched = await openEmbed(page, SOURCES.mp4, {
    ctaEnd: { enabled: true, title: "Thanks for watching" },
  });
  await expect(page.locator("player-stack video")).toHaveAttribute("src", SOURCES.mp4);
  await expect
    .poll(() => lazyFiles(fetched))
    .toEqual([expect.stringMatching(/^playerstack-plugin-cta-end\.js\?v=[0-9a-f]{8}$/)]);
  const video = page.locator("player-stack video");
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).duration), { timeout: 15000 })
    .toBeGreaterThan(1);
  await video.evaluate((el) => {
    const video = el as HTMLVideoElement;
    video.muted = true;
    video.currentTime = video.duration - 0.25;
  });
  await page.locator("player-stack media-play-button").click();
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).ended), { timeout: 15000 })
    .toBe(true);
  await expect(page.locator(".playerstack-cta-title")).toHaveText("Thanks for watching");
});

test("foundation configuration loads its four plugins, defers MP4, and supports CTA replay", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  const fetched = await openEmbed(page, SOURCES.mp4, {
    controls: { accent: "#008AFF" },
    brandedThumb: {
      enabled: true,
      clickToLoad: true,
      playButtonStyle: "circle",
      playLabel: "Odtwórz film zapraszający",
    },
    customCss: {
      enabled: true,
      acknowledgeTrusted: true,
      trustedCss: ".playerstack-cta { background: rgba(0, 39, 83, 0.94) !important; }",
    },
    ctaEnd: {
      enabled: true,
      title: "Webinar",
      button: { label: "Zapisuję się na webinar", url: "https://example.com/webinar/#zapis" },
      showReplay: true,
      replayLabel: "Obejrzyj jeszcze raz",
    },
  });
  const video = page.locator("player-stack video");
  const play = page.locator("button.playerstack-thumb-play");
  await expect(play).toBeVisible();
  expect(await video.getAttribute("src")).toBeNull();
  await expect
    .poll(() =>
      lazyFiles(fetched)
        .map((f) => f.split("?")[0])
        .sort(),
    )
    .toEqual([
      "playerstack-plugin-branded-thumb.js",
      "playerstack-plugin-controls-policy.js",
      "playerstack-plugin-cta-end.js",
      "playerstack-plugin-custom-css.js",
    ]);
  await play.click();
  await expect(video).toHaveAttribute("src", SOURCES.mp4);
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).paused), { timeout: 15000 })
    .toBe(false);
  await video.evaluate((el) => {
    (el as HTMLVideoElement).pause();
    el.dispatchEvent(new Event("ended"));
  });
  await expect(page.getByRole("link", { name: "Zapisuję się na webinar" })).toBeVisible();
  await expect(page.locator(".playerstack-cta")).toHaveCSS(
    "background-color",
    "rgba(0, 39, 83, 0.94)",
  );
  await page.getByRole("button", { name: "Obejrzyj jeszcze raz" }).click();
  await expect(page.locator(".playerstack-cta")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("email gate is downloaded only when enabled and submits through the existing event bus", async ({
  page,
}) => {
  const fetched = await openEmbed(page, SOURCES.mp4, {
    emailGate: { enabled: true, title: "Continue watching", buttonLabel: "Continue" },
  });
  await expect(page.locator(".playerstack-email-gate")).toBeVisible();
  expect(lazyFiles(fetched)).toEqual([
    expect.stringMatching(/^playerstack-plugin-email-gate\.js\?v=[0-9a-f]{8}$/),
  ]);
  await page.getByRole("textbox").fill("viewer@example.com");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".playerstack-email-gate")).toHaveCount(0);
});

test("multiple players share a plugin download and initialize independently", async ({ page }) => {
  const config = { ctaEnd: { enabled: true, title: "Finished" } };
  const fetched = await openEmbed(page, SOURCES.mp4, config);
  await expect(page.locator("player-stack video")).toHaveAttribute("src", SOURCES.mp4);
  await page.evaluate(
    ({ src, config }) => {
      const player = document.createElement("player-stack");
      player.setAttribute("src", src);
      player.setAttribute("data-config", JSON.stringify(config));
      document.body.appendChild(player);
    },
    { src: SOURCES.mp4, config },
  );
  await expect(page.locator("player-stack video").nth(1)).toHaveAttribute("src", SOURCES.mp4);
  await page.locator("player-stack video").nth(1).dispatchEvent("ended");
  await expect(page.locator("player-stack").nth(1).locator(".playerstack-cta-title")).toHaveText(
    "Finished",
  );
  expect(lazyFiles(fetched)).toHaveLength(1);
});

test("failed poster download emits plugin-load and leaves MP4 playable with native controls", async ({
  page,
}) => {
  await page.addInitScript(() =>
    document.addEventListener("playerstack:error", (event) => {
      (window as { __pluginError?: unknown }).__pluginError = (event as CustomEvent).detail;
    }),
  );
  await openEmbed(
    page,
    SOURCES.mp4,
    { brandedThumb: { enabled: true, clickToLoad: true } },
    async (file) => !file.startsWith("playerstack-plugin-branded-thumb."),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as { __pluginError?: { reason: string; plugin: string } }).__pluginError,
      ),
    )
    .toMatchObject({ reason: "plugin-load", plugin: "branded-thumb" });
  const video = page.locator("player-stack video");
  await expect(video).toHaveAttribute("src", SOURCES.mp4);
  await page.locator("player-stack media-play-button").click();
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).paused), { timeout: 15000 })
    .toBe(false);
});

test("plugin downloads finish before a preview can emit native media events", async ({ page }) => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const request = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const opened = openEmbed(
    page,
    SOURCES.mp4,
    { preview: { enabled: true }, savedPosition: { enabled: true } },
    async (file) => {
      if (file.startsWith("playerstack-plugin-saved-position.")) {
        requested();
        await wait;
      }
      return true;
    },
  );
  await request;
  expect(await page.locator("player-stack video").getAttribute("src")).toBeNull();
  release();
  await opened;
  await expect(page.locator("player-stack video")).toHaveAttribute("src", SOURCES.mp4);
});

test("a source-type change during a plugin download uses the latest source", async ({ page }) => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const request = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const opened = openEmbed(page, SOURCES.mp4, { ctaEnd: { enabled: true } }, async (file) => {
    if (file.startsWith("playerstack-plugin-cta-end.")) {
      requested();
      await wait;
    }
    return true;
  });
  await request;
  await page
    .locator("player-stack")
    .evaluate((el, src) => el.setAttribute("src", src), SOURCES.hls);
  release();
  await opened;
  await expect(page.locator("player-stack hls-video")).toHaveAttribute("src", SOURCES.hls);
  await expect(page.locator("player-stack media-controller")).toHaveCount(1);
});

test("removing a player during a plugin download cancels its init and reconnects once", async ({
  page,
}) => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const request = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const opened = openEmbed(page, SOURCES.mp4, { brandedThumb: { enabled: true } }, async (file) => {
    if (file.startsWith("playerstack-plugin-branded-thumb.")) {
      requested();
      await wait;
    }
    return true;
  });
  await request;
  await page.evaluate(() => {
    const player = document.querySelector("player-stack")!;
    (window as { __removedPlayer?: Element }).__removedPlayer = player;
    player.remove();
  });
  release();
  await opened;
  expect(
    await page.evaluate(() =>
      (window as { __removedPlayer?: Element }).__removedPlayer?.querySelector(
        ".playerstack-thumb",
      ),
    ),
  ).toBeNull();
  await page.evaluate(() =>
    document.body.appendChild((window as { __removedPlayer?: Element }).__removedPlayer!),
  );
  await expect(page.locator("player-stack .playerstack-thumb")).toHaveCount(1);
  await expect(page.locator("player-stack media-controller")).toHaveCount(1);
});
