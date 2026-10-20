import { test, expect, type Page } from "@playwright/test";
import { SOURCES, openEmbed, observeStandalone } from "./standalone-helpers";

observeStandalone();

function pausePlugin(page: Page, config: Record<string, unknown>, name = "cta-end") {
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const request = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const opened = openEmbed(page, SOURCES.mp4, config, async (file) => {
    if (file.startsWith(`playerstack-plugin-${name}.`)) {
      requested();
      await paused;
    }
    return true;
  });
  return { request, release: () => release(), opened };
}

for (const delayed of ["controls-policy", "cta-end"]) {
  test(`first visible controls respect configuration while ${delayed} downloads`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const sample = () => {
        const controller = document.querySelector("player-stack media-controller");
        const fullscreen = controller?.querySelector("media-fullscreen-button");
        if (controller && fullscreen && getComputedStyle(controller).visibility === "visible") {
          (window as { firstControls?: unknown }).firstControls = {
            accent: getComputedStyle(controller).getPropertyValue("--media-primary-color").trim(),
            fullscreen: getComputedStyle(fullscreen).display,
          };
        } else {
          requestAnimationFrame(sample);
        }
      };
      requestAnimationFrame(sample);
    });
    const pending = pausePlugin(
      page,
      {
        controls: { accent: "#ff0000", show: ["play"] },
        ctaEnd: { enabled: true },
      },
      delayed,
    );
    await pending.request;
    try {
      await expect(page.locator("player-stack media-controller")).toHaveCount(1);
      await expect(page.locator("player-stack media-controller")).toBeHidden();
    } finally {
      pending.release();
      await pending.opened;
    }
    await expect(page.locator("player-stack media-play-button")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as { firstControls?: unknown }).firstControls))
      .toEqual({ accent: "#ff0000", fullscreen: "none" });
  });
}

for (const src of ["https://ps.test/latest.mp4", SOURCES.hls]) {
  test(`source changed during plugin download never requests the old MP4 (${src.endsWith("mp4") ? "MP4" : "HLS"})`, async ({
    page,
  }) => {
    const oldRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url() === SOURCES.mp4) oldRequests.push(request.url());
    });
    await page.route("https://ps.test/latest.mp4", (route) => route.fulfill({ status: 204 }));
    const pending = pausePlugin(page, { ctaEnd: { enabled: true } });
    await pending.request;
    await page.locator("player-stack").evaluate((el, src) => el.setAttribute("src", src), src);
    pending.release();
    await pending.opened;
    await expect(page.locator("player-stack [slot=media]")).toHaveAttribute("src", src);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(oldRequests).toEqual([]);
    await expect(page.locator("player-stack media-controller")).toHaveCount(1);
  });
}

test("poster and title changes during download reach the media and thumbnail plugin", async ({
  page,
}) => {
  const poster = "https://ps.test/latest.png";
  await page.route(poster, (route) => route.fulfill({ status: 204 }));
  const pending = pausePlugin(page, { brandedThumb: { enabled: true } }, "branded-thumb");
  await pending.request;
  await page.locator("player-stack").evaluate((el, poster) => {
    el.setAttribute("poster", poster);
    el.setAttribute("title", "Latest title");
  }, poster);
  pending.release();
  await pending.opened;
  await expect(page.locator("player-stack video")).toHaveAttribute("poster", poster);
  await expect(page.locator("player-stack video")).toHaveAttribute("title", "Latest title");
  await expect(page.locator(".playerstack-thumb img")).toHaveAttribute("src", poster);
  await expect(page.locator(".playerstack-thumb")).toHaveCount(1);
});

test("disconnect and reconnect before download completes initializes only the current source", async ({
  page,
}) => {
  const oldRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url() === SOURCES.mp4) oldRequests.push(request.url());
  });
  const src = "https://ps.test/reconnected.mp4";
  await page.route(src, (route) => route.fulfill({ status: 204 }));
  const pending = pausePlugin(page, { ctaEnd: { enabled: true, title: "Reconnected" } });
  await pending.request;
  await page.locator("player-stack").evaluate((el, src) => {
    el.remove();
    el.setAttribute("src", src);
    document.body.appendChild(el);
  }, src);
  pending.release();
  await pending.opened;
  await expect(page.locator("player-stack video")).toHaveAttribute("src", src);
  await page.locator("player-stack video").dispatchEvent("ended");
  await expect(page.locator(".playerstack-cta-title")).toHaveText("Reconnected");
  expect(oldRequests).toEqual([]);
  await expect(page.locator("player-stack media-controller")).toHaveCount(1);
});
