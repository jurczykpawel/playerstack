import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { autopreviewPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

interface MockObserverInstance {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  trigger: (isIntersecting: boolean) => void;
}

let observers: MockObserverInstance[] = [];
let prefersReducedMotion = false;

beforeEach(() => {
  observers = [];
  prefersReducedMotion = false;

  class MockIO {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    private cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
      const instance: MockObserverInstance = {
        observe: this.observe,
        unobserve: this.unobserve,
        disconnect: this.disconnect,
        trigger: (isIntersecting: boolean) => {
          this.cb(
            [{ isIntersecting } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        },
      };
      observers.push(instance);
    }
  }
  globalThis.IntersectionObserver = MockIO as unknown as typeof IntersectionObserver;

  globalThis.matchMedia = ((query: string) => ({
    matches: query.includes("reduce") ? prefersReducedMotion : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof matchMedia;
});

afterEach(() => {
  // @ts-expect-error cleanup
  delete globalThis.IntersectionObserver;
});

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext & {
  playSpy: ReturnType<typeof vi.fn>;
  pauseSpy: ReturnType<typeof vi.fn>;
} {
  const container = document.createElement("div");
  const mediaPlayer = document.createElement("media-player") as HTMLElement & {
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    muted: boolean;
  };
  mediaPlayer.play = vi.fn(() => Promise.resolve());
  mediaPlayer.pause = vi.fn();
  mediaPlayer.muted = false;
  container.appendChild(mediaPlayer);
  return Object.assign(
    {
      events: createEventBus(),
      container,
      mediaPlayer,
      config: { src: "https://example.com/v.mp4", ...extra },
    } as PlayerstackContext,
    { playSpy: mediaPlayer.play, pauseSpy: mediaPlayer.pause },
  );
}

describe("autopreviewPlugin", () => {
  it("has a stable name", () => {
    expect(autopreviewPlugin.name).toBe("autopreview");
  });

  it("does nothing when preview.enabled is not true", async () => {
    const ctx = makeContext();
    await autopreviewPlugin.init(ctx);
    expect(observers.length).toBe(0);
  });

  it("creates an IntersectionObserver when preview.enabled is true", async () => {
    const ctx = makeContext({ preview: { enabled: true } } as PlayerstackConfig);
    await autopreviewPlugin.init(ctx);
    expect(observers.length).toBe(1);
    expect(observers[0]?.observe).toHaveBeenCalledWith(ctx.mediaPlayer);
  });

  it("calls play() and mutes mediaPlayer when it enters the viewport", async () => {
    const ctx = makeContext({ preview: { enabled: true } } as PlayerstackConfig);
    await autopreviewPlugin.init(ctx);
    observers[0]?.trigger(true);
    expect(ctx.playSpy).toHaveBeenCalled();
    expect((ctx.mediaPlayer as HTMLElement & { muted: boolean }).muted).toBe(true);
  });

  it("calls pause() when mediaPlayer leaves the viewport", async () => {
    const ctx = makeContext({ preview: { enabled: true } } as PlayerstackConfig);
    await autopreviewPlugin.init(ctx);
    observers[0]?.trigger(true);
    observers[0]?.trigger(false);
    expect(ctx.pauseSpy).toHaveBeenCalled();
  });

  it("respects prefers-reduced-motion and never plays automatically", async () => {
    prefersReducedMotion = true;
    const ctx = makeContext({ preview: { enabled: true } } as PlayerstackConfig);
    await autopreviewPlugin.init(ctx);
    observers[0]?.trigger(true);
    expect(ctx.playSpy).not.toHaveBeenCalled();
  });

  it("destroy disconnects the observer", async () => {
    const ctx = makeContext({ preview: { enabled: true } } as PlayerstackConfig);
    await autopreviewPlugin.init(ctx);
    autopreviewPlugin.destroy?.(ctx);
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });
});
