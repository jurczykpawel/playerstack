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
    await expect(video).toHaveAttribute(
      "src",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    );
  });

  test("controls-policy applies inline brand vars and document-scoped hide CSS", async ({
    page,
  }) => {
    await page.goto("/");
    // controls-policy plugin sets vars on whatever ctx.mediaPlayer is — now it's the inner <video>.
    const mp4 = page.locator("player-stack").nth(1).locator("video");
    await expect(mp4).toHaveCSS("--media-brand", "#008aff");
    await expect(mp4).toHaveCSS("--ps-accent", "#008aff");
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
