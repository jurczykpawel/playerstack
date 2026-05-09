import { test, expect } from "@playwright/test";

test.describe("playground embed", () => {
  test("YouTube source renders as Vidstack media-player", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("player-stack").first()).toBeVisible();
    await expect(page.locator("media-player").first()).toBeAttached();
    await expect(page.locator("media-player").first()).toHaveAttribute(
      "src",
      "youtube/_cMxraX_5RE",
    );
  });

  test("MP4 source renders as Vidstack media-player", async ({ page }) => {
    await page.goto("/");
    const mp4Player = page.locator("player-stack").nth(1);
    await expect(mp4Player).toBeVisible();
    const inner = mp4Player.locator("media-player");
    await expect(inner).toHaveAttribute("src", "https://files.vidstack.io/sprite-fight/720p.mp4");
  });

  test("controls-policy injects style block when configured", async ({ page }) => {
    await page.goto("/");
    const mp4Player = page.locator("player-stack").nth(1);
    const styleBlock = mp4Player.locator("style[data-playerstack='controls-policy']");
    await expect(styleBlock).toBeAttached();
    const css = await styleBlock.textContent();
    expect(css).toContain("--ps-accent: #008aff");
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
