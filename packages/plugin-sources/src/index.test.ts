import { describe, expect, it } from "vitest";
import { sourcesPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext } from "@playerstack/core";

function makeContext(src: string): PlayerstackContext {
  const container = document.createElement("div");
  const mediaPlayer = document.createElement("media-player");
  container.appendChild(mediaPlayer);
  return {
    events: createEventBus(),
    container,
    mediaPlayer,
    config: { src },
  } as PlayerstackContext;
}

describe("sourcesPlugin", () => {
  it("has a stable name", () => {
    expect(sourcesPlugin.name).toBe("sources");
  });

  it("rewrites a YouTube URL on mediaPlayer to Vidstack format", async () => {
    const ctx = makeContext("https://youtu.be/dQw4w9WgXcQ");
    await sourcesPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("youtube/dQw4w9WgXcQ");
  });

  it("rewrites a Vimeo URL on mediaPlayer to Vidstack format", async () => {
    const ctx = makeContext("https://vimeo.com/123456789");
    await sourcesPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("vimeo/123456789");
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
});
