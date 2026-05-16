import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

let beaconMock: ReturnType<typeof vi.fn>;
let gtagMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  beaconMock = vi.fn(() => true);
  gtagMock = vi.fn();
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: beaconMock,
  });
  (globalThis as unknown as { gtag?: unknown }).gtag = gtagMock;
});

afterEach(() => {
  delete (globalThis as { gtag?: unknown }).gtag;
});

type MockMediaPlayer = HTMLElement & { currentTime: number; duration: number };

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  const mediaPlayer = document.createElement("media-player") as unknown as MockMediaPlayer;
  mediaPlayer.currentTime = 0;
  mediaPlayer.duration = NaN;
  container.appendChild(mediaPlayer);
  return {
    events: createEventBus(),
    container,
    mediaPlayer,
    config: { src: "https://example.com/v.mp4", ...extra },
  } as PlayerstackContext;
}

describe("analyticsPlugin", () => {
  it("has a stable name", () => {
    expect(analyticsPlugin.name).toBe("analytics");
  });

  it("does nothing when not enabled", async () => {
    const ctx = makeContext();
    await analyticsPlugin.init(ctx);
    ctx.events.emit("cta:click", { label: "x", url: "y" });
    expect(beaconMock).not.toHaveBeenCalled();
  });

  it("with endpoint: sends sendBeacon on cta:click", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, endpoint: "https://example.com/api/track" },
    });
    await analyticsPlugin.init(ctx);
    ctx.events.emit("cta:click", { label: "Buy", url: "https://example.com/buy" });
    expect(beaconMock).toHaveBeenCalled();
    const [url, body] = beaconMock.mock.calls[0] ?? [];
    expect(url).toBe("https://example.com/api/track");
    const payload = JSON.parse(body as string);
    expect(payload.event).toBe("cta:click");
    expect(payload.data.label).toBe("Buy");
  });

  it("forwards thumb:click and cta:replay events", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, endpoint: "https://example.com/api/track" },
    });
    await analyticsPlugin.init(ctx);
    ctx.events.emit("thumb:click", undefined);
    ctx.events.emit("cta:replay", undefined);
    expect(beaconMock).toHaveBeenCalledTimes(2);
  });

  it("forwards native play / pause / ended events on mediaPlayer", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, endpoint: "https://example.com/api/track" },
    });
    await analyticsPlugin.init(ctx);
    ctx.mediaPlayer.dispatchEvent(new Event("play"));
    ctx.mediaPlayer.dispatchEvent(new Event("pause"));
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    expect(beaconMock).toHaveBeenCalledTimes(3);
  });

  it("with provider='gtag': calls window.gtag instead of sendBeacon", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, provider: "gtag" },
    });
    await analyticsPlugin.init(ctx);
    ctx.events.emit("cta:click", { label: "Buy", url: "x" });
    expect(gtagMock).toHaveBeenCalled();
    expect(beaconMock).not.toHaveBeenCalled();
  });

  it("includes customProps in every payload", async () => {
    const ctx = makeContext({
      analytics: {
        enabled: true,
        endpoint: "https://example.com/track",
        customProps: { courseId: "abc-123" },
      },
    });
    await analyticsPlugin.init(ctx);
    ctx.events.emit("thumb:click", undefined);
    const body = JSON.parse(beaconMock.mock.calls[0]?.[1] as string);
    expect(body.data.courseId).toBe("abc-123");
  });

  it("destroy stops listeners — no further events get reported", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, endpoint: "https://example.com/track" },
    });
    await analyticsPlugin.init(ctx);
    analyticsPlugin.destroy?.(ctx);
    ctx.events.emit("thumb:click", undefined);
    ctx.mediaPlayer.dispatchEvent(new Event("play"));
    expect(beaconMock).not.toHaveBeenCalled();
  });

  it("quartile tracking: emits progress on 25/50/75/100 crossings (default)", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, endpoint: "https://example.com/track" },
    });
    const media = ctx.mediaPlayer as unknown as MockMediaPlayer;
    media.duration = 100;
    await analyticsPlugin.init(ctx);

    const events: { event: string; data: Record<string, unknown> }[] = [];
    beaconMock.mockImplementation((_url, body) => {
      events.push(JSON.parse(body as string));
      return true;
    });

    for (const t of [10, 25, 40, 50, 70, 75, 99, 100]) {
      media.currentTime = t;
      media.dispatchEvent(new Event("timeupdate"));
    }

    const progressEvents = events.filter((e) => e.event === "progress");
    expect(progressEvents.map((e) => e.data.percent)).toEqual([25, 50, 75, 100]);
  });

  it("quartile tracking: each threshold fires only once per session", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, endpoint: "https://example.com/track" },
    });
    const media = ctx.mediaPlayer as unknown as MockMediaPlayer;
    media.duration = 100;
    await analyticsPlugin.init(ctx);

    media.currentTime = 30;
    media.dispatchEvent(new Event("timeupdate"));
    media.currentTime = 30;
    media.dispatchEvent(new Event("timeupdate"));
    media.currentTime = 35;
    media.dispatchEvent(new Event("timeupdate"));

    const calls = beaconMock.mock.calls
      .map(([, b]) => JSON.parse(b as string) as { event: string })
      .filter((e) => e.event === "progress");
    expect(calls).toHaveLength(1);
  });

  it("quartile tracking: resets on loadedmetadata so a new video gets fresh thresholds", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, endpoint: "https://example.com/track" },
    });
    const media = ctx.mediaPlayer as unknown as MockMediaPlayer;
    media.duration = 100;
    await analyticsPlugin.init(ctx);

    media.currentTime = 30;
    media.dispatchEvent(new Event("timeupdate"));
    media.dispatchEvent(new Event("loadedmetadata"));
    media.currentTime = 30;
    media.dispatchEvent(new Event("timeupdate"));

    const calls = beaconMock.mock.calls
      .map(([, b]) => JSON.parse(b as string) as { event: string; data: { percent: number } })
      .filter((e) => e.event === "progress");
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.data.percent === 25)).toBe(true);
  });

  it("quartile tracking: quartiles=false disables it entirely", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, endpoint: "https://example.com/track", quartiles: false },
    });
    const media = ctx.mediaPlayer as unknown as MockMediaPlayer;
    media.duration = 100;
    await analyticsPlugin.init(ctx);

    media.currentTime = 50;
    media.dispatchEvent(new Event("timeupdate"));
    media.currentTime = 99;
    media.dispatchEvent(new Event("timeupdate"));

    const progress = beaconMock.mock.calls
      .map(([, b]) => JSON.parse(b as string) as { event: string })
      .filter((e) => e.event === "progress");
    expect(progress).toHaveLength(0);
  });

  it("quartile tracking: custom thresholds override the defaults", async () => {
    const ctx = makeContext({
      analytics: {
        enabled: true,
        endpoint: "https://example.com/track",
        quartiles: [10, 90],
      },
    });
    const media = ctx.mediaPlayer as unknown as MockMediaPlayer;
    media.duration = 100;
    await analyticsPlugin.init(ctx);

    for (const t of [5, 10, 50, 89, 90, 100]) {
      media.currentTime = t;
      media.dispatchEvent(new Event("timeupdate"));
    }

    const percents = beaconMock.mock.calls
      .map(([, b]) => JSON.parse(b as string) as { event: string; data: { percent: number } })
      .filter((e) => e.event === "progress")
      .map((e) => e.data.percent);
    expect(percents).toEqual([10, 90]);
  });

  it("quartile tracking: skips when duration is not finite (live / unknown)", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, endpoint: "https://example.com/track" },
    });
    const media = ctx.mediaPlayer as unknown as MockMediaPlayer;
    media.duration = NaN;
    await analyticsPlugin.init(ctx);

    media.currentTime = 1000;
    media.dispatchEvent(new Event("timeupdate"));

    const progress = beaconMock.mock.calls
      .map(([, b]) => JSON.parse(b as string) as { event: string })
      .filter((e) => e.event === "progress");
    expect(progress).toHaveLength(0);
  });

  it("does not initialize when provider='beacon' and endpoint is not an http(s) URL", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const endpoint of [
      "/api/track",
      "javascript:x",
      "data:text/plain,x",
      undefined as unknown as string,
    ]) {
      beaconMock.mockClear();
      const ctx = makeContext({ analytics: { enabled: true, endpoint } });
      await analyticsPlugin.init(ctx);
      ctx.events.emit("cta:click", { label: "x", url: "y" });
      expect(beaconMock).not.toHaveBeenCalled();
    }
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
