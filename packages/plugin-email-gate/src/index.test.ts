import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailGatePlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  document.body.appendChild(container);
  // Use a fake custom element tag so happy-dom doesn't enforce HTMLVideoElement's
  // readonly duration/currentTime getters. The plugin only relies on
  // addEventListener/dispatchEvent + duck-typed currentTime/duration/pause/play.
  const mediaPlayer = document.createElement("media-player") as unknown as HTMLElement & {
    pause: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    currentTime: number;
    duration: number;
  };
  mediaPlayer.pause = vi.fn();
  mediaPlayer.play = vi.fn(() => Promise.resolve());
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
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
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
  document.body.innerHTML = "";
});

describe("emailGatePlugin", () => {
  it("has a stable name", () => {
    expect(emailGatePlugin.name).toBe("email-gate");
  });

  it("does nothing when not enabled", async () => {
    const ctx = makeContext();
    await emailGatePlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-email-gate")).toBeNull();
  });

  it("with at='before' (open mode, no webhook): shows form immediately and pauses video", async () => {
    const ctx = makeContext({ emailGate: { enabled: true, at: "before" } });
    await emailGatePlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-email-gate")).not.toBeNull();
    expect(
      (ctx.mediaPlayer as unknown as { pause: ReturnType<typeof vi.fn> }).pause,
    ).toHaveBeenCalled();
  });

  it("renders email input and submit button", async () => {
    const ctx = makeContext({ emailGate: { enabled: true, at: "before" } });
    await emailGatePlugin.init(ctx);
    expect(ctx.container.querySelector("input[type='email']")).not.toBeNull();
    expect(ctx.container.querySelector("button[type='submit']")).not.toBeNull();
  });

  it("renders an off-screen honeypot field", async () => {
    const ctx = makeContext({ emailGate: { enabled: true, at: "before" } });
    await emailGatePlugin.init(ctx);
    const honey = ctx.container.querySelector("input[name='website']") as HTMLInputElement;
    expect(honey).not.toBeNull();
    expect(honey.tabIndex).toBe(-1);
    expect(honey.style.position).toBe("absolute");
  });

  it("filled honeypot makes submit silently succeed (overlay removed, no event, no fetch)", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = makeContext({ emailGate: { enabled: true, at: "before" } });
    const handler = vi.fn();
    ctx.events.on("email-gate:submit", handler);
    await emailGatePlugin.init(ctx);

    const form = ctx.container.querySelector("form") as HTMLFormElement;
    (form.querySelector("input[type='email']") as HTMLInputElement).value = "real@x.com";
    (form.querySelector("input[name='website']") as HTMLInputElement).value = "bot-filled-this";
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

    expect(ctx.container.querySelector(".playerstack-email-gate")).toBeNull();
    expect(handler).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submitting valid email in open mode emits email-gate:submit and removes overlay", async () => {
    const ctx = makeContext({ emailGate: { enabled: true, at: "before" } });
    const handler = vi.fn();
    ctx.events.on("email-gate:submit", handler);
    await emailGatePlugin.init(ctx);

    const form = ctx.container.querySelector("form") as HTMLFormElement;
    const input = form.querySelector("input[type='email']") as HTMLInputElement;
    input.value = "test@example.com";
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

    // open-mode handler resolves synchronously through the form's submit handler
    await new Promise((r) => setTimeout(r, 10));
    expect(handler).toHaveBeenCalledWith({ email: "test@example.com" });
    expect(ctx.container.querySelector(".playerstack-email-gate")).toBeNull();
  });

  it("submitting empty email does NOT emit and keeps overlay", async () => {
    const ctx = makeContext({ emailGate: { enabled: true, at: "before" } });
    const handler = vi.fn();
    ctx.events.on("email-gate:submit", handler);
    await emailGatePlugin.init(ctx);

    const form = ctx.container.querySelector("form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
    expect(ctx.container.querySelector(".playerstack-email-gate")).not.toBeNull();
  });

  it("after submit, subsequent inits skip the gate (localStorage memo)", async () => {
    const cfg = { emailGate: { enabled: true, at: "before" as const } };
    const a = makeContext(cfg);
    await emailGatePlugin.init(a);
    const form = a.container.querySelector("form") as HTMLFormElement;
    (form.querySelector("input[type='email']") as HTMLInputElement).value = "u@example.com";
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));

    const b = makeContext(cfg);
    await emailGatePlugin.init(b);
    expect(b.container.querySelector(".playerstack-email-gate")).toBeNull();
  });

  it("with at=50 (percent): no overlay until currentTime crosses 50%", async () => {
    const ctx = makeContext({ emailGate: { enabled: true, at: 50 } });
    const player = ctx.mediaPlayer as HTMLElement & { currentTime: number; duration: number };
    await emailGatePlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-email-gate")).toBeNull();

    player.currentTime = 49;
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    expect(ctx.container.querySelector(".playerstack-email-gate")).toBeNull();

    player.currentTime = 51;
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    expect(ctx.container.querySelector(".playerstack-email-gate")).not.toBeNull();
  });

  it("REFUSES to render when webhookUrl is set without challengeUrl (secure-by-default)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = makeContext({
      emailGate: {
        enabled: true,
        at: "before",
        webhookUrl: "https://example.com/lead",
        // challengeUrl intentionally missing
      },
    });
    await emailGatePlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-email-gate")).toBeNull();
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls[0]?.[0]).toMatch(/secure verification|challengeUrl/i);
    errSpy.mockRestore();
  });

  it("destroy removes the overlay", async () => {
    const ctx = makeContext({ emailGate: { enabled: true, at: "before" } });
    await emailGatePlugin.init(ctx);
    emailGatePlugin.destroy?.(ctx);
    expect(ctx.container.querySelector(".playerstack-email-gate")).toBeNull();
  });
});
