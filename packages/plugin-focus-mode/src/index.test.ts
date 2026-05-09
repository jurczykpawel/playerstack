import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { focusModePlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

let visibility: "visible" | "hidden" = "visible";

function setVisibility(v: "visible" | "hidden") {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  // Reset between tests
});

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  const mediaPlayer = document.createElement("media-player") as unknown as HTMLElement & {
    pause: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    paused: boolean;
  };
  mediaPlayer.pause = vi.fn();
  mediaPlayer.play = vi.fn(() => Promise.resolve());
  mediaPlayer.paused = false;
  container.appendChild(mediaPlayer);
  return {
    events: createEventBus(),
    container,
    mediaPlayer,
    config: { src: "https://example.com/v.mp4", ...extra },
  } as PlayerstackContext;
}

describe("focusModePlugin", () => {
  it("has a stable name", () => {
    expect(focusModePlugin.name).toBe("focus-mode");
  });

  it("does nothing when not enabled", async () => {
    const ctx = makeContext();
    await focusModePlugin.init(ctx);
    setVisibility("hidden");
    expect(
      (ctx.mediaPlayer as unknown as { pause: ReturnType<typeof vi.fn> }).pause,
    ).not.toHaveBeenCalled();
  });

  it("pauses video when document becomes hidden", async () => {
    const ctx = makeContext({ focusMode: { enabled: true } });
    await focusModePlugin.init(ctx);
    setVisibility("hidden");
    expect(
      (ctx.mediaPlayer as unknown as { pause: ReturnType<typeof vi.fn> }).pause,
    ).toHaveBeenCalled();
  });

  it("resumes video when document becomes visible (if was playing before)", async () => {
    const ctx = makeContext({ focusMode: { enabled: true, resumeOnVisible: true } });
    await focusModePlugin.init(ctx);
    setVisibility("hidden");
    (ctx.mediaPlayer as unknown as { paused: boolean }).paused = true;
    setVisibility("visible");
    expect(
      (ctx.mediaPlayer as unknown as { play: ReturnType<typeof vi.fn> }).play,
    ).toHaveBeenCalled();
  });

  it("does NOT resume when resumeOnVisible is false (default)", async () => {
    const ctx = makeContext({ focusMode: { enabled: true } });
    await focusModePlugin.init(ctx);
    setVisibility("hidden");
    (ctx.mediaPlayer as unknown as { paused: boolean }).paused = true;
    setVisibility("visible");
    expect(
      (ctx.mediaPlayer as unknown as { play: ReturnType<typeof vi.fn> }).play,
    ).not.toHaveBeenCalled();
  });

  it("emits focus-mode:hidden and focus-mode:visible events", async () => {
    const ctx = makeContext({ focusMode: { enabled: true } });
    const hidden = vi.fn();
    const visible = vi.fn();
    ctx.events.on("focus-mode:hidden", hidden);
    ctx.events.on("focus-mode:visible", visible);
    await focusModePlugin.init(ctx);
    setVisibility("hidden");
    setVisibility("visible");
    expect(hidden).toHaveBeenCalled();
    expect(visible).toHaveBeenCalled();
  });

  it("destroy removes the visibilitychange listener", async () => {
    const ctx = makeContext({ focusMode: { enabled: true } });
    await focusModePlugin.init(ctx);
    focusModePlugin.destroy?.(ctx);
    setVisibility("hidden");
    expect(
      (ctx.mediaPlayer as unknown as { pause: ReturnType<typeof vi.fn> }).pause,
    ).not.toHaveBeenCalled();
  });
});
