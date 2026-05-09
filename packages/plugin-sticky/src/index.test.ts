import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stickyPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

interface Mock {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  trigger: (visible: boolean) => void;
}

let observers: Mock[] = [];

beforeEach(() => {
  observers = [];
  class IO {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    private cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
      observers.push({
        observe: this.observe,
        disconnect: this.disconnect,
        trigger: (visible) =>
          this.cb(
            [{ isIntersecting: visible } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          ),
      });
    }
  }
  globalThis.IntersectionObserver = IO as unknown as typeof IntersectionObserver;
});

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const mediaPlayer = document.createElement("media-player") as unknown as HTMLElement & {
    paused: boolean;
  };
  mediaPlayer.paused = false;
  container.appendChild(mediaPlayer);
  const ps = document.createElement("player-stack");
  ps.appendChild(mediaPlayer);
  container.appendChild(ps);
  return {
    events: createEventBus(),
    container: ps,
    mediaPlayer,
    config: { src: "https://example.com/v.mp4", ...extra },
  } as PlayerstackContext;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("stickyPlugin", () => {
  it("has a stable name", () => {
    expect(stickyPlugin.name).toBe("sticky");
  });

  it("does nothing when not enabled", async () => {
    const ctx = makeContext();
    await stickyPlugin.init(ctx);
    expect(observers.length).toBe(0);
  });

  it("creates an observer on container when enabled", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    expect(observers.length).toBe(1);
  });

  it("adds 'playerstack-sticky' class to container when player leaves viewport AND is playing", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    observers[0]?.trigger(false);
    expect(ctx.container.classList.contains("playerstack-sticky")).toBe(true);
  });

  it("removes the class when player returns to viewport", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    observers[0]?.trigger(false);
    observers[0]?.trigger(true);
    expect(ctx.container.classList.contains("playerstack-sticky")).toBe(false);
  });

  it("does NOT stick when player is paused", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    (ctx.mediaPlayer as unknown as { paused: boolean }).paused = true;
    await stickyPlugin.init(ctx);
    observers[0]?.trigger(false);
    expect(ctx.container.classList.contains("playerstack-sticky")).toBe(false);
  });

  it("renders a close button when sticky", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    observers[0]?.trigger(false);
    expect(ctx.container.querySelector(".playerstack-sticky-close")).not.toBeNull();
  });

  it("clicking close removes sticky and disconnects observer", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    observers[0]?.trigger(false);
    const close = ctx.container.querySelector(".playerstack-sticky-close") as HTMLButtonElement;
    close.click();
    expect(ctx.container.classList.contains("playerstack-sticky")).toBe(false);
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });

  it("destroy removes class and disconnects observer", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    observers[0]?.trigger(false);
    stickyPlugin.destroy?.(ctx);
    expect(ctx.container.classList.contains("playerstack-sticky")).toBe(false);
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });
});
