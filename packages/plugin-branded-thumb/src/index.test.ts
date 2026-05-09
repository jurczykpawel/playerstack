import { describe, expect, it, vi } from "vitest";
import { brandedThumbPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  const mediaPlayer = document.createElement("media-player");
  mediaPlayer.setAttribute("src", "youtube/abc123");
  if (extra.poster) mediaPlayer.setAttribute("poster", extra.poster);
  container.appendChild(mediaPlayer);
  return {
    events: createEventBus(),
    container,
    mediaPlayer,
    config: { src: "https://youtu.be/abc123", ...extra },
  } as PlayerstackContext;
}

describe("brandedThumbPlugin", () => {
  it("has a stable name", () => {
    expect(brandedThumbPlugin.name).toBe("branded-thumb");
  });

  it("does nothing when brandedThumb is not enabled", async () => {
    const ctx = makeContext();
    await brandedThumbPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-thumb")).toBeNull();
  });

  it("inserts an overlay with poster image when enabled", async () => {
    const ctx = makeContext({
      poster: "https://cdn.example.com/poster.jpg",
      brandedThumb: { enabled: true },
    });
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb");
    expect(overlay).not.toBeNull();
    const img = overlay?.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example.com/poster.jpg");
  });

  it("inserts a play button with default 'circle' style", async () => {
    const ctx = makeContext({ brandedThumb: { enabled: true } });
    await brandedThumbPlugin.init(ctx);
    const button = ctx.container.querySelector(".playerstack-thumb-play");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("data-style")).toBe("circle");
  });

  it("supports playButtonStyle minimal/box/circle", async () => {
    for (const style of ["minimal", "box", "circle"] as const) {
      const ctx = makeContext({
        brandedThumb: { enabled: true, playButtonStyle: style },
      });
      await brandedThumbPlugin.init(ctx);
      const button = ctx.container.querySelector(".playerstack-thumb-play");
      expect(button?.getAttribute("data-style")).toBe(style);
    }
  });

  it("with clickToLoad: removes src from mediaPlayer and stores it for later", async () => {
    const ctx = makeContext({
      brandedThumb: { enabled: true, clickToLoad: true },
    });
    await brandedThumbPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBeNull();
  });

  it("without clickToLoad: leaves mediaPlayer src untouched", async () => {
    const ctx = makeContext({
      brandedThumb: { enabled: true, clickToLoad: false },
    });
    await brandedThumbPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("youtube/abc123");
  });

  it("clicking the overlay restores mediaPlayer src and removes overlay", async () => {
    const ctx = makeContext({
      brandedThumb: { enabled: true, clickToLoad: true },
    });
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    overlay.click();
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("youtube/abc123");
    expect(ctx.container.querySelector(".playerstack-thumb")).toBeNull();
  });

  it("emits a 'thumb:click' event on the bus when overlay is clicked", async () => {
    const ctx = makeContext({
      brandedThumb: { enabled: true },
    });
    const handler = vi.fn();
    ctx.events.on("thumb:click", handler);
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    overlay.click();
    expect(handler).toHaveBeenCalled();
  });

  it("destroy removes overlay and restores src if it was held", async () => {
    const ctx = makeContext({
      brandedThumb: { enabled: true, clickToLoad: true },
    });
    await brandedThumbPlugin.init(ctx);
    brandedThumbPlugin.destroy?.(ctx);
    expect(ctx.container.querySelector(".playerstack-thumb")).toBeNull();
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("youtube/abc123");
  });
});
