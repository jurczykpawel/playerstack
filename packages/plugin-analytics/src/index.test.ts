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

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  const mediaPlayer = document.createElement("media-player") as unknown as HTMLElement & {
    currentTime: number;
  };
  mediaPlayer.currentTime = 0;
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
      analytics: { enabled: true, endpoint: "/api/track" },
    });
    await analyticsPlugin.init(ctx);
    ctx.events.emit("cta:click", { label: "Buy", url: "https://example.com/buy" });
    expect(beaconMock).toHaveBeenCalled();
    const [url, body] = beaconMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/track");
    const payload = JSON.parse(body as string);
    expect(payload.event).toBe("cta:click");
    expect(payload.data.label).toBe("Buy");
  });

  it("forwards thumb:click and cta:replay events", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, endpoint: "/api/track" },
    });
    await analyticsPlugin.init(ctx);
    ctx.events.emit("thumb:click", undefined);
    ctx.events.emit("cta:replay", undefined);
    expect(beaconMock).toHaveBeenCalledTimes(2);
  });

  it("forwards native play / pause / ended events on mediaPlayer", async () => {
    const ctx = makeContext({
      analytics: { enabled: true, endpoint: "/api/track" },
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
        endpoint: "/track",
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
      analytics: { enabled: true, endpoint: "/track" },
    });
    await analyticsPlugin.init(ctx);
    analyticsPlugin.destroy?.(ctx);
    ctx.events.emit("thumb:click", undefined);
    ctx.mediaPlayer.dispatchEvent(new Event("play"));
    expect(beaconMock).not.toHaveBeenCalled();
  });
});
