import { describe, expect, it } from "vitest";
import { sourcesPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(src: string, extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  const mediaPlayer = document.createElement("media-player");
  container.appendChild(mediaPlayer);
  return {
    events: createEventBus(),
    container,
    mediaPlayer,
    config: { src, ...extra },
  } as PlayerstackContext;
}

describe("sourcesPlugin", () => {
  it("has a stable name", () => {
    expect(sourcesPlugin.name).toBe("sources");
  });

  it("passes a YouTube URL through unchanged (Mux <youtube-video> takes raw URL)", async () => {
    const ctx = makeContext("https://youtu.be/dQw4w9WgXcQ");
    await sourcesPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("https://youtu.be/dQw4w9WgXcQ");
  });

  it("passes a Vimeo URL through unchanged (Mux <vimeo-video> takes raw URL)", async () => {
    const ctx = makeContext("https://vimeo.com/123456789");
    await sourcesPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("https://vimeo.com/123456789");
  });

  it.each([
    "https://fast.wistia.com/embed/medias/abc123xyz",
    "https://fast.wistia.com/embed/iframe/abc123xyz",
    "https://acme.wistia.com/medias/abc123xyz",
    "https://wi.st/medias/abc123xyz",
  ])("hands <wistia-video> the media id it can parse for %s", async (url) => {
    const ctx = makeContext(url);
    await sourcesPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("https://fast.wistia.com/medias/abc123xyz");
  });

  it("gives click-to-load the same Wistia URL to set on click", async () => {
    const ctx = makeContext("https://fast.wistia.com/embed/iframe/abc123xyz", {
      brandedThumb: { clickToLoad: true },
    } as Partial<PlayerstackConfig>);
    await sourcesPlugin.init(ctx);
    expect(ctx.mediaPlayer.hasAttribute("src")).toBe(false);
    expect(ctx.config.src).toBe("https://fast.wistia.com/medias/abc123xyz");
  });

  it("passes through MP4 URLs unchanged", async () => {
    const url = "https://example.com/v.mp4";
    const ctx = makeContext(url);
    await sourcesPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBe(url);
  });

  it("passes through HLS URLs unchanged", async () => {
    const url = "https://example.com/p.m3u8";
    const ctx = makeContext(url);
    await sourcesPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBe(url);
  });

  it("throws when the source cannot be resolved", async () => {
    const ctx = makeContext("https://example.com/v.avi");
    await expect(sourcesPlugin.init(ctx)).rejects.toThrow(/cannot resolve/i);
  });

  it("throws when src is unresolvable even with brandedThumb.clickToLoad=true", async () => {
    const ctx = makeContext("not-a-supported-source:x", {
      brandedThumb: { enabled: true, clickToLoad: true },
    } as unknown as Partial<PlayerstackConfig>);
    await expect(sourcesPlugin.init(ctx)).rejects.toThrow(/cannot resolve/i);
  });

  it("with brandedThumb.clickToLoad=true and a resolvable src: does not set src attribute yet", async () => {
    const ctx = makeContext("https://example.com/v.mp4", {
      brandedThumb: { enabled: true, clickToLoad: true },
    } as unknown as Partial<PlayerstackConfig>);
    await sourcesPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBeNull();
  });
});
