import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailGatePlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
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
  document.querySelectorAll(".playerstack-email-gate").forEach((el) => el.remove());
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

  it("with at='before': shows form immediately and pauses video", async () => {
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

  it("submitting valid email emits email-gate:submit and removes overlay", async () => {
    const ctx = makeContext({ emailGate: { enabled: true, at: "before" } });
    const handler = vi.fn();
    ctx.events.on("email-gate:submit", handler);
    await emailGatePlugin.init(ctx);

    const form = ctx.container.querySelector("form") as HTMLFormElement;
    const input = form.querySelector("input[type='email']") as HTMLInputElement;
    input.value = "test@example.com";
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

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

    const b = makeContext(cfg);
    await emailGatePlugin.init(b);
    expect(b.container.querySelector(".playerstack-email-gate")).toBeNull();
  });

  it("with at=50 (percent): no overlay until currentTime crosses 50%", async () => {
    const ctx = makeContext({ emailGate: { enabled: true, at: 50 } });
    const player = ctx.mediaPlayer as HTMLElement & { currentTime: number; duration: number };
    await emailGatePlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-email-gate")).toBeNull();

    // Simulate timeupdate at 49% — still hidden
    player.currentTime = 49;
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    expect(ctx.container.querySelector(".playerstack-email-gate")).toBeNull();

    // Cross threshold
    player.currentTime = 51;
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    expect(ctx.container.querySelector(".playerstack-email-gate")).not.toBeNull();
  });

  it("optional webhookUrl receives a POST with the email payload", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = makeContext({
      emailGate: {
        enabled: true,
        at: "before",
        webhookUrl: "https://example.com/lead",
      },
    });
    await emailGatePlugin.init(ctx);
    const form = ctx.container.querySelector("form") as HTMLFormElement;
    (form.querySelector("input[type='email']") as HTMLInputElement).value = "x@y.com";
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

    expect(fetchMock).toHaveBeenCalled();
    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;
    expect(call?.[0]).toBe("https://example.com/lead");
    expect(call?.[1].method).toBe("POST");
    expect(call?.[1].body).toContain("x@y.com");
  });

  it("destroy removes the overlay", async () => {
    const ctx = makeContext({ emailGate: { enabled: true, at: "before" } });
    await emailGatePlugin.init(ctx);
    emailGatePlugin.destroy?.(ctx);
    expect(ctx.container.querySelector(".playerstack-email-gate")).toBeNull();
  });
});
