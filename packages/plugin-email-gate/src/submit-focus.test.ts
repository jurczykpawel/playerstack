import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventBus, type PlayerstackContext } from "@playerstack/core";
import { ctaEndPlugin } from "../../plugin-cta-end/src/index";
import { emailGatePlugin } from "./index";
vi.mock("altcha-lib", () => ({
  solveChallenge: () => ({ promise: Promise.resolve({ number: 7 }) }),
}));
const contexts: PlayerstackContext[] = [];
const observers: MutationObserver[] = [];
const challenge = {
  nonce: "one",
  altcha: { algorithm: "SHA-256", challenge: "c", salt: "s", signature: "signature" },
};
function setup(options: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  container.innerHTML =
    '<media-controller tabindex="0"><media-play-button tabindex="0"></media-play-button><video></video></media-controller>';
  document.body.append(container);
  const mediaPlayer = Object.assign(container.querySelector("video")!, {
    pause: vi.fn(),
    play: vi.fn(),
  });
  const ctx = {
    container,
    mediaPlayer,
    events: createEventBus(),
    config: {
      src: "movie.mp4",
      ctaEnd: { enabled: true, button: { label: "Offer", url: "https://example.com" } },
      emailGate: {
        enabled: true,
        remember: false,
        webhookUrl: "https://api.example/lead",
        challengeUrl: "https://api.example/challenge",
        ...options,
      },
    },
  } as unknown as PlayerstackContext;
  contexts.push(ctx);
  return ctx;
}
function form(ctx: PlayerstackContext) {
  const email = ctx.container.querySelector<HTMLInputElement>('input[type="email"]')!;
  email.value = "viewer@example.com";
  const submit = ctx.container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  return {
    email,
    submit,
    send: () =>
      ctx.container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true })),
  };
}
function browserFocusFixup(ctx: PlayerstackContext) {
  // happy-dom does not implement the browser's focus fixup for a disabled button.
  const observer = new MutationObserver(() => {
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && active.disabled) active.blur();
  });
  observer.observe(ctx.container, {
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });
  observers.push(observer);
}
afterEach(() => {
  for (const observer of observers.splice(0)) observer.disconnect();
  for (const ctx of contexts.splice(0)) {
    emailGatePlugin.destroy?.(ctx);
    ctaEndPlugin.destroy?.(ctx);
  }
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("submit focus", () => {
  for (const target of ["play", "CTA"] as const) {
    it(`keeps focus off BODY while the disabled request is pending and returns to ${target}`, async () => {
      let resolve!: (response: Response) => void;
      const fetcher = vi
        .fn()
        .mockReturnValueOnce(
          new Promise<Response>((r) => {
            resolve = r;
          }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
      vi.stubGlobal("fetch", fetcher);
      const ctx = setup({ at: target === "CTA" ? "after" : "before" });
      const play = ctx.container.querySelector<HTMLElement>("media-play-button")!;
      play.focus();
      if (target === "CTA") await ctaEndPlugin.init(ctx);
      await emailGatePlugin.init(ctx);
      if (target === "CTA") ctx.mediaPlayer.dispatchEvent(new Event("ended"));
      browserFocusFixup(ctx);
      const f = form(ctx);
      f.submit.focus();
      f.send();
      await Promise.resolve();
      expect(f.submit.disabled).toBe(true);
      expect(document.activeElement).toBe(f.email);
      resolve(Response.json(challenge));
      await vi.waitFor(() => expect(ctx.container.querySelector("form")).toBeNull());
      expect(document.activeElement).toBe(
        target === "CTA" ? ctx.container.querySelector(".playerstack-cta-button") : play,
      );
    });
  }
  it("stops before networking when the stable-focus listener destroys the instance", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const ctx = setup();
    await emailGatePlugin.init(ctx);
    const f = form(ctx);
    f.submit.focus();
    f.email.addEventListener("focus", () => emailGatePlugin.destroy?.(ctx), { once: true });
    f.send();
    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
    expect(ctx.container.querySelector("form")).toBeNull();
  });
  it("allows only one request if a focus listener submits again", async () => {
    const fetcher = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetcher);
    const ctx = setup();
    await emailGatePlugin.init(ctx);
    const f = form(ctx);
    f.submit.focus();
    f.email.addEventListener("focus", f.send, { once: true });
    f.send();
    await Promise.resolve();
    expect(document.activeElement).toBe(f.email);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("preserves focus moved outside the player during a request", async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<Response>((r) => {
          resolve = r;
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    const ctx = setup();
    await emailGatePlugin.init(ctx);
    const f = form(ctx);
    f.submit.focus();
    f.send();
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    resolve(Response.json(challenge));
    await vi.waitFor(() => expect(ctx.container.querySelector("form")).toBeNull());
    expect(document.activeElement).toBe(outside);
  });
  it("can retry after a request failure with stable focus and a fresh request", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(Response.json(challenge))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    const ctx = setup();
    await emailGatePlugin.init(ctx);
    const f = form(ctx);
    f.submit.focus();
    f.send();
    await vi.waitFor(() => expect(f.submit.disabled).toBe(false));
    f.submit.focus();
    f.send();
    await vi.waitFor(() => expect(ctx.container.querySelector("form")).toBeNull());
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
