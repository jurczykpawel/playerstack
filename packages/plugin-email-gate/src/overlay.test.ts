import { afterEach, describe, expect, it, vi } from "vitest";
import { activateOverlay, createEventBus, type PlayerstackContext } from "@playerstack/core";
import { emailGatePlugin } from "./index";
import { brandedThumbPlugin } from "../../plugin-branded-thumb/src/index";

function setup(options: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  container.innerHTML =
    '<media-controller tabindex="0"><media-play-button tabindex="0"></media-play-button></media-controller>';
  document.body.append(container);
  const mediaPlayer = Object.assign(document.createElement("video"), {
    play: vi.fn(),
    pause: vi.fn(),
  });
  container.querySelector("media-controller")!.append(mediaPlayer);
  const ctx = {
    container,
    mediaPlayer,
    events: createEventBus(),
    config: {
      src: "overlay.mp4",
      emailGate: { enabled: true, remember: false, at: "after", ...options },
    },
  } as unknown as PlayerstackContext;
  return { ctx, container, play: container.querySelector<HTMLElement>("media-play-button")! };
}
const input = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[type="email"]')!;
const close = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("email overlay layers", () => {
  it("a late real thumbnail retains its controller lock when the gate closes", async () => {
    const { ctx, container } = setup({ at: "before", dismissible: true });
    Object.assign(ctx.config, { brandedThumb: { enabled: true } });
    await emailGatePlugin.init(ctx);
    await brandedThumbPlugin.init(ctx);
    await Promise.resolve();
    close(container);
    expect(container.querySelector(".playerstack-thumb")).not.toBeNull();
    expect(container.querySelector("media-controller")!.hasAttribute("inert")).toBe(true);
    container.querySelector<HTMLButtonElement>(".playerstack-thumb-play")!.click();
    expect(container.querySelector("media-controller")!.hasAttribute("inert")).toBe(false);
    emailGatePlugin.destroy?.(ctx);
  });
  it("destroying a real thumbnail under a gate releases only the thumbnail lock", async () => {
    const { ctx, container } = setup({ at: "before", dismissible: true });
    Object.assign(ctx.config, { brandedThumb: { enabled: true } });
    await brandedThumbPlugin.init(ctx);
    await emailGatePlugin.init(ctx);
    brandedThumbPlugin.destroy?.(ctx);
    await Promise.resolve();
    expect(container.querySelector("media-controller")!.hasAttribute("inert")).toBe(true);
    emailGatePlugin.destroy?.(ctx);
    expect(container.querySelector("media-controller")!.hasAttribute("inert")).toBe(false);
  });
  it("destroy in the submit listener prevents later status and playback effects", async () => {
    const { ctx, container } = setup({ at: "before" });
    await emailGatePlugin.init(ctx);
    ctx.events.on("email-gate:submit", () => emailGatePlugin.destroy?.(ctx));
    input(container).value = "viewer@example.com";
    container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await Promise.resolve();
    expect({
      statusPresent: !!container.querySelector(".playerstack-email-gate-status"),
      playCalls: vi.mocked((ctx.mediaPlayer as HTMLVideoElement).play).mock.calls.length,
    }).toEqual({ statusPresent: false, playCalls: 0 });
  });
  for (const method of ["click", "Escape"]) {
    it(`destroy in the dismiss listener prevents later effects (${method})`, async () => {
      const { ctx, container } = setup({ at: "before", dismissible: true });
      const storage = { setItem: vi.fn(), getItem: vi.fn() };
      vi.stubGlobal("localStorage", storage);
      Object.assign(ctx.config, { emailGate: { enabled: true, at: "before", dismissible: true } });
      const submit = vi.fn();
      const dismiss = vi.fn(() => emailGatePlugin.destroy?.(ctx));
      ctx.events.on("email-gate:submit", submit);
      ctx.events.on("email-gate:dismiss", dismiss);
      await emailGatePlugin.init(ctx);
      const oldForm = container.querySelector("form")!;
      const oldOverlay = container.querySelector(".playerstack-email-gate")!;
      if (method === "click") close(container);
      else
        input(container).dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      await Promise.resolve();
      expect({
        playCalls: vi.mocked((ctx.mediaPlayer as HTMLVideoElement).play).mock.calls.length,
        elements: container.querySelectorAll(
          ".playerstack-email-gate,.playerstack-email-gate-status",
        ).length,
        memoWrites: storage.setItem.mock.calls.length,
        submissions: submit.mock.calls.length,
        dismissals: dismiss.mock.calls.length,
      }).toEqual({ playCalls: 0, elements: 0, memoWrites: 0, submissions: 0, dismissals: 1 });
      ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
      ctx.mediaPlayer.dispatchEvent(new Event("ended"));
      expect(container.querySelector(".playerstack-email-gate")).toBeNull();
      oldForm.dispatchEvent(new Event("submit", { cancelable: true }));
      oldOverlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(dismiss).toHaveBeenCalledOnce();
      expect(submit).not.toHaveBeenCalled();
    });
  }
  it("does not update a destroyed form after a request rejection", async () => {
    let reject!: (reason: Error) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((_resolve, r) => {
            reject = r;
          }),
      ),
    );
    const { ctx, container } = setup({
      at: "before",
      webhookUrl: "https://api.example/lead",
      challengeUrl: "https://api.example/challenge",
    });
    await emailGatePlugin.init(ctx);
    input(container).value = "viewer@example.com";
    const form = container.querySelector("form")!;
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    emailGatePlugin.destroy?.(ctx);
    reject(new Error("network"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(submit.disabled).toBe(true);
  });
  it("does not solve or send after destruction while challenge JSON is pending", async () => {
    let resolveJson!: (value: unknown) => void;
    const json = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveJson = resolve;
        }),
    );
    const fetcher = vi.fn(async () => ({ ok: true, json }));
    vi.stubGlobal("fetch", fetcher);
    const { ctx, container } = setup({
      at: "before",
      webhookUrl: "https://api.example/lead",
      challengeUrl: "https://api.example/challenge",
    });
    await emailGatePlugin.init(ctx);
    input(container).value = "viewer@example.com";
    const status = container.querySelector(".playerstack-email-gate-status")!;
    container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(json).toHaveBeenCalledOnce());
    emailGatePlugin.destroy?.(ctx);
    resolveJson({
      altcha: {
        algorithm: "SHA-256",
        challenge: "c",
        salt: "s",
        signature: "signature",
        maxnumber: 0,
      },
      nonce: "n",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(status.textContent).toBe("Verifying…");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  for (const mode of ["before", "after", "seconds", "percent"] as const) {
    for (const action of ["submit", "dismiss"] as const) {
      it(`destroy on focus restoration stops later ${action} effects (${mode})`, async () => {
        const options =
          mode === "seconds"
            ? { at: 5 }
            : mode === "percent"
              ? { at: undefined, atPercent: 50 }
              : { at: mode };
        const { ctx, container, play } = setup({ ...options, dismissible: true });
        play.focus();
        await emailGatePlugin.init(ctx);
        if (mode === "after") ctx.mediaPlayer.dispatchEvent(new Event("ended"));
        else if (mode !== "before") {
          Object.assign(ctx.mediaPlayer, { currentTime: 6 });
          Object.defineProperty(ctx.mediaPlayer, "duration", { value: 10, configurable: true });
          ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
        }
        expect(document.activeElement).toBe(input(container));
        let destroyed = false;
        const eventsAfterDestroy: string[] = [];
        ctx.events.on("email-gate:submit", () => {
          if (destroyed) eventsAfterDestroy.push("submit");
        });
        ctx.events.on("email-gate:dismiss", () => {
          if (destroyed) eventsAfterDestroy.push("dismiss");
        });
        play.addEventListener(
          "focus",
          () => {
            destroyed = true;
            emailGatePlugin.destroy?.(ctx);
          },
          { once: true },
        );
        if (action === "dismiss") close(container);
        else {
          input(container).value = "viewer@example.com";
          container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
        }
        await Promise.resolve();
        expect(destroyed).toBe(true);
        expect({
          statusPresent: !!container.querySelector(".playerstack-email-gate-status"),
          gatePresent: !!container.querySelector(".playerstack-email-gate"),
          playCalls: vi.mocked((ctx.mediaPlayer as HTMLVideoElement).play).mock.calls.length,
          eventsAfterDestroy,
        }).toEqual({
          statusPresent: false,
          gatePresent: false,
          playCalls: 0,
          eventsAfterDestroy: [],
        });
      });
    }
  }
  for (const at of ["before", "after"] as const) {
    for (const callback of ["focus", "pause"] as const) {
      it(`destroy during initial ${callback} leaves no gate or lock (${at})`, async () => {
        const { ctx, container, play } = setup({ at });
        play.focus();
        if (callback === "focus")
          container.addEventListener("focusin", (event) => {
            if ((event.target as HTMLElement).matches('input[type="email"]'))
              emailGatePlugin.destroy?.(ctx);
          });
        else
          vi.mocked((ctx.mediaPlayer as HTMLVideoElement).pause).mockImplementation(() => {
            emailGatePlugin.destroy?.(ctx);
          });
        await emailGatePlugin.init(ctx);
        if (at === "after") ctx.mediaPlayer.dispatchEvent(new Event("ended"));
        expect(container.querySelector(".playerstack-email-gate")).toBeNull();
        expect(play.closest("[inert]")).toBeNull();
        ctx.mediaPlayer.dispatchEvent(new Event("ended"));
        expect(container.querySelector(".playerstack-email-gate")).toBeNull();
      });
    }
  }
  it("focuses email after player interaction and releases covered controls on Escape", async () => {
    const { ctx, container, play } = setup();
    await emailGatePlugin.init(ctx);
    play.focus();
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    expect(document.activeElement).toBe(input(container));
    expect(play.closest("[inert]")).not.toBeNull();
    input(container).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(container.querySelector(".playerstack-email-gate")).toBeNull();
    expect(play.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(play);
    emailGatePlugin.destroy?.(ctx);
  });
  it("preserves external focus when playback ends", async () => {
    const { ctx, container } = setup();
    const external = document.createElement("button");
    document.body.append(external);
    await emailGatePlugin.init(ctx);
    external.focus();
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    expect(document.activeElement).toBe(external);
    expect(ctx.mediaPlayer.closest("[inert]")).not.toBeNull();
    close(container);
    expect(document.activeElement).toBe(external);
    emailGatePlugin.destroy?.(ctx);
  });
  for (const order of ["cta-first", "email-first"]) {
    it(`returns focus to the remaining CTA (${order})`, async () => {
      const { ctx, container, play } = setup();
      const cta = document.createElement("div");
      cta.innerHTML = '<a href="/offer">Offer</a>';
      let release = () => {};
      const showCta = () => {
        container.append(cta);
        release = activateOverlay(container, cta, 3, true);
      };
      if (order === "cta-first") ctx.mediaPlayer.addEventListener("ended", showCta);
      await emailGatePlugin.init(ctx);
      if (order === "email-first") ctx.mediaPlayer.addEventListener("ended", showCta);
      play.focus();
      ctx.mediaPlayer.dispatchEvent(new Event("ended"));
      expect(document.activeElement).toBe(input(container));
      expect(cta.hasAttribute("inert")).toBe(true);
      close(container);
      expect(cta.hasAttribute("inert")).toBe(false);
      expect(document.activeElement).toBe(cta.firstElementChild);
      release();
      emailGatePlugin.destroy?.(ctx);
    });
  }
  for (const action of ["dismiss", "submit", "destroy"]) {
    it(`releases a before gate over a late thumbnail on ${action}`, async () => {
      const { ctx, container } = setup({ at: "before", dismissible: true });
      await emailGatePlugin.init(ctx);
      const thumb = document.createElement("button");
      thumb.className = "playerstack-thumb-play";
      container.append(thumb);
      await Promise.resolve();
      expect(thumb.hasAttribute("inert")).toBe(true);
      input(container).focus();
      if (action === "dismiss") close(container);
      else if (action === "destroy") emailGatePlugin.destroy?.(ctx);
      else {
        input(container).value = "viewer@example.com";
        container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
        await Promise.resolve();
      }
      expect(thumb.hasAttribute("inert")).toBe(false);
      expect(document.activeElement).toBe(thumb);
      emailGatePlugin.destroy?.(ctx);
    });
  }
  it("releases during a pending request without later success", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((r) => {
            resolve = r;
          }),
      ),
    );
    const { ctx, container, play } = setup({
      webhookUrl: "https://api.example/lead",
      challengeUrl: "https://api.example/challenge",
    });
    const success = vi.fn();
    ctx.events.on("email-gate:submit", success);
    await emailGatePlugin.init(ctx);
    play.focus();
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    input(container).value = "viewer@example.com";
    container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    emailGatePlugin.destroy?.(ctx);
    expect(play.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(play);
    resolve(new Response("{}"));
    await Promise.resolve();
    await Promise.resolve();
    expect(success).not.toHaveBeenCalled();
  });
  for (const at of [5, "before"] as const) {
    it(`restores play after resuming a ${at} gate`, async () => {
      const { ctx, container, play } = setup({ at, dismissible: true });
      play.focus();
      await emailGatePlugin.init(ctx);
      if (typeof at === "number") {
        Object.assign(ctx.mediaPlayer, { currentTime: 6 });
        ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
      }
      expect(document.activeElement).toBe(input(container));
      close(container);
      expect(document.activeElement).toBe(play);
      expect((ctx.mediaPlayer as HTMLVideoElement).play).toHaveBeenCalledOnce();
      emailGatePlugin.destroy?.(ctx);
    });
  }
  it("releases covered controls when a filled auxiliary field closes the form", async () => {
    const { ctx, container, play } = setup();
    await emailGatePlugin.init(ctx);
    play.focus();
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    input(container).focus();
    container.querySelector<HTMLInputElement>('[name="website"]')!.value = "example";
    container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(play.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(play);
    emailGatePlugin.destroy?.(ctx);
  });
  it("moves focus from body after earlier pointer interaction", async () => {
    const { ctx, container } = setup();
    await emailGatePlugin.init(ctx);
    container.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    expect(document.activeElement).toBe(input(container));
    emailGatePlugin.destroy?.(ctx);
  });
});
