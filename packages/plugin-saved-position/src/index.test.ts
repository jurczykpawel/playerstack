import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savedPositionPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  const mediaPlayer = document.createElement("media-player") as unknown as HTMLElement & {
    currentTime: number;
    duration: number;
  };
  mediaPlayer.currentTime = 0;
  mediaPlayer.duration = 100;
  container.appendChild(mediaPlayer);
  return {
    events: createEventBus(),
    container,
    mediaPlayer,
    config: { src: "https://example.com/v.mp4", ...extra },
  } as PlayerstackContext;
}

beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("savedPositionPlugin", () => {
  it("has a stable name", () => {
    expect(savedPositionPlugin.name).toBe("saved-position");
  });

  it("does nothing when not enabled", async () => {
    const ctx = makeContext();
    await savedPositionPlugin.init(ctx);
    const player = ctx.mediaPlayer as HTMLElement & { currentTime: number };
    player.currentTime = 42;
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    expect(localStorage.length).toBe(0);
  });

  it("saves currentTime on timeupdate when enabled (debounced)", async () => {
    vi.useFakeTimers();
    const ctx = makeContext({ savedPosition: { enabled: true, throttleMs: 100 } });
    await savedPositionPlugin.init(ctx);
    const player = ctx.mediaPlayer as HTMLElement & { currentTime: number };
    player.currentTime = 25;
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    vi.advanceTimersByTime(150);
    expect(localStorage.getItem("playerstack:pos:https://example.com/v.mp4")).toBe("25");
  });

  it("restores saved position on loadedmetadata", async () => {
    localStorage.setItem("playerstack:pos:https://example.com/v.mp4", "42");
    const ctx = makeContext({ savedPosition: { enabled: true } });
    await savedPositionPlugin.init(ctx);
    ctx.mediaPlayer.dispatchEvent(new Event("loadedmetadata"));
    const player = ctx.mediaPlayer as HTMLElement & { currentTime: number };
    expect(player.currentTime).toBe(42);
  });

  it("does NOT restore if saved position is within last 5 seconds of duration (already finished)", async () => {
    localStorage.setItem("playerstack:pos:https://example.com/v.mp4", "98");
    const ctx = makeContext({ savedPosition: { enabled: true } });
    await savedPositionPlugin.init(ctx);
    ctx.mediaPlayer.dispatchEvent(new Event("loadedmetadata"));
    const player = ctx.mediaPlayer as HTMLElement & { currentTime: number };
    expect(player.currentTime).toBe(0);
  });

  it("clears storage on ended event", async () => {
    localStorage.setItem("playerstack:pos:https://example.com/v.mp4", "50");
    const ctx = makeContext({ savedPosition: { enabled: true } });
    await savedPositionPlugin.init(ctx);
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    expect(localStorage.getItem("playerstack:pos:https://example.com/v.mp4")).toBeNull();
  });

  it("respects custom keyPrefix", async () => {
    vi.useFakeTimers();
    const ctx = makeContext({
      savedPosition: { enabled: true, keyPrefix: "myapp:vid", throttleMs: 50 },
    });
    await savedPositionPlugin.init(ctx);
    const player = ctx.mediaPlayer as HTMLElement & { currentTime: number };
    player.currentTime = 7;
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    vi.advanceTimersByTime(80);
    expect(localStorage.getItem("myapp:vid:https://example.com/v.mp4")).toBe("7");
  });

  it("destroy stops listeners", async () => {
    vi.useFakeTimers();
    const ctx = makeContext({ savedPosition: { enabled: true, throttleMs: 50 } });
    await savedPositionPlugin.init(ctx);
    savedPositionPlugin.destroy?.(ctx);
    const player = ctx.mediaPlayer as HTMLElement & { currentTime: number };
    player.currentTime = 99;
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    vi.advanceTimersByTime(80);
    expect(localStorage.getItem("playerstack:pos:https://example.com/v.mp4")).toBeNull();
  });
});
