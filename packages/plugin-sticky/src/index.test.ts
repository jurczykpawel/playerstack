import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stickyPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

type TriggerFn = (ratio: number) => void;

let triggers: TriggerFn[] = [];
let disconnectFns: ReturnType<typeof vi.fn>[] = [];

beforeEach(() => {
  triggers = [];
  disconnectFns = [];
  class IO {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    private cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
      const disconnect = this.disconnect;
      disconnectFns.push(disconnect);
      triggers.push((ratio) =>
        this.cb(
          [{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        ),
      );
    }
  }
  globalThis.IntersectionObserver = IO as unknown as typeof IntersectionObserver;
});

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const wrapper = document.createElement("div");
  document.body.appendChild(wrapper);
  const mediaPlayer = document.createElement("media-player") as unknown as HTMLElement & {
    paused: boolean;
  };
  mediaPlayer.paused = false;
  const ps = document.createElement("player-stack");
  ps.appendChild(mediaPlayer);
  wrapper.appendChild(ps);
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
    expect(triggers.length).toBe(0);
  });

  it("creates an observer on container when enabled", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    expect(triggers.length).toBe(1);
  });

  it("adds 'playerstack-sticky' class when player leaves viewport and is playing", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    triggers[0]?.(0); // ratio=0 → leave viewport
    expect(ctx.container.classList.contains("playerstack-sticky")).toBe(true);
  });

  it("inserts a placeholder sibling when sticky", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    triggers[0]?.(0);
    const placeholder = ctx.container.parentElement?.querySelector("[aria-hidden='true']");
    expect(placeholder).not.toBeNull();
  });

  it("removes sticky and placeholder when ratio crosses exit threshold", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    triggers[0]?.(0);   // go sticky
    triggers[0]?.(1);   // return to view (ratio=1 > exitThreshold=0.5)
    expect(ctx.container.classList.contains("playerstack-sticky")).toBe(false);
    expect(ctx.container.parentElement?.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("does NOT stick when player is paused", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    (ctx.mediaPlayer as unknown as { paused: boolean }).paused = true;
    await stickyPlugin.init(ctx);
    triggers[0]?.(0);
    expect(ctx.container.classList.contains("playerstack-sticky")).toBe(false);
  });

  it("renders a close button when sticky", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    triggers[0]?.(0);
    expect(ctx.container.querySelector(".playerstack-sticky-close")).not.toBeNull();
  });

  it("clicking close removes sticky and disconnects observer", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    triggers[0]?.(0);
    const close = ctx.container.querySelector(".playerstack-sticky-close") as HTMLButtonElement;
    close.click();
    expect(ctx.container.classList.contains("playerstack-sticky")).toBe(false);
    expect(disconnectFns[0]).toHaveBeenCalled();
  });

  it("destroy removes class, placeholder and disconnects observer", async () => {
    const ctx = makeContext({ sticky: { enabled: true } });
    await stickyPlugin.init(ctx);
    triggers[0]?.(0);
    stickyPlugin.destroy?.(ctx);
    expect(ctx.container.classList.contains("playerstack-sticky")).toBe(false);
    expect(ctx.container.parentElement?.querySelector("[aria-hidden='true']")).toBeNull();
    expect(disconnectFns[0]).toHaveBeenCalled();
  });
});
