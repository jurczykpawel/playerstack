import { test, expect } from "@playwright/test";

test.describe("playground embed", () => {
  test("YouTube source renders as <youtube-video> element", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("player-stack").first()).toBeVisible();
    const ytEl = page.locator("player-stack").first().locator("youtube-video");
    await expect(ytEl).toBeAttached();
    await expect(ytEl).toHaveAttribute("src", "https://youtu.be/_cMxraX_5RE");
  });

  test("MP4 source renders as <video> element", async ({ page }) => {
    await page.goto("/");
    const mp4Player = page.locator("player-stack").nth(1);
    await expect(mp4Player).toBeVisible();
    const video = mp4Player.locator("video");
    await expect(video).toHaveAttribute("src", "https://media.w3.org/2010/05/sintel/trailer.mp4");
  });

  test("MP4 source actually loads (no CORS gate, no crossorigin attribute by default)", async ({
    page,
  }) => {
    // Regression: forcing `crossorigin=""` in core would silently break every
    // public MP4 host that doesn't ship CORS headers (W3C, GCS, plain S3, …).
    // Two assertions:
    //  1. The default <video> must NOT carry a crossorigin attribute.
    //  2. The asset reaches readyState >= 1 (HAVE_METADATA), proving load.
    await page.goto("/");
    const video = page.locator("player-stack").nth(1).locator("video");
    await expect(video).not.toHaveAttribute("crossorigin", /.*/);
    await expect
      .poll(async () => video.evaluate((el: HTMLVideoElement) => el.readyState), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(1);
  });

  test("controls-policy applies inline brand vars on container and document-scoped hide CSS", async ({
    page,
  }) => {
    await page.goto("/");
    // controls-policy plugin sets vars on ctx.container (<player-stack>) so
    // they cascade to <media-controller> and <media-control-bar>, which are
    // siblings of the inner <video> element.
    const playerStack = page.locator("player-stack").nth(1);
    await expect(playerStack).toHaveCSS("--media-brand", "#008aff");
    await expect(playerStack).toHaveCSS("--ps-accent", "#008aff");
    // Hide-rules CSS lives in document.head, scoped per-instance.
    const docStyle = page.locator("head style[data-playerstack='controls-policy']");
    await expect(docStyle.first()).toBeAttached();
    const css = await docStyle.first().textContent();
    expect(css).toMatch(/data-ps-id="ps-\d+"/);
  });

  test("plugins were registered on Playerstack singleton", async ({ page }) => {
    await page.goto("/");
    const plugins = await page.evaluate(() => {
      const ps = (window as unknown as { Playerstack?: { plugins(): readonly { name: string }[] } })
        .Playerstack;
      return ps?.plugins().map((p) => p.name) ?? [];
    });
    expect(plugins).toContain("sources");
    expect(plugins).toContain("controls-policy");
  });
});
