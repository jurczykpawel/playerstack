import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watermarkPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const mediaPlayer = document.createElement("media-player") as HTMLElement;
  container.appendChild(mediaPlayer);
  return {
    events: createEventBus(),
    container,
    mediaPlayer,
    config: { src: "https://example.com/v.mp4", ...extra },
  } as PlayerstackContext;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("watermarkPlugin", () => {
  it("has a stable name", () => {
    expect(watermarkPlugin.name).toBe("watermark");
  });

  it("does nothing when disabled", async () => {
    const ctx = makeContext();
    await watermarkPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-watermark")).toBeNull();
  });

  it("renders an image overlay when src is provided", async () => {
    const ctx = makeContext({
      watermark: { enabled: true, src: "https://example.com/logo.png" },
    });
    await watermarkPlugin.init(ctx);
    const wm = ctx.container.querySelector(".playerstack-watermark");
    expect(wm).not.toBeNull();
    const img = wm!.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("https://example.com/logo.png");
    expect(img!.getAttribute("alt")).toBe("");
  });

  it("renders a text overlay when text is provided", async () => {
    const ctx = makeContext({
      watermark: { enabled: true, text: "© ACME 2026" },
    });
    await watermarkPlugin.init(ctx);
    const wm = ctx.container.querySelector(".playerstack-watermark");
    expect(wm?.textContent).toBe("© ACME 2026");
    expect(wm?.querySelector("img")).toBeNull();
  });

  it("does nothing when neither src nor text is provided", async () => {
    const ctx = makeContext({ watermark: { enabled: true } });
    await watermarkPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-watermark")).toBeNull();
  });

  it("default position is bottom-right", async () => {
    const ctx = makeContext({ watermark: { enabled: true, text: "x" } });
    await watermarkPlugin.init(ctx);
    const wm = ctx.container.querySelector(".playerstack-watermark") as HTMLElement;
    expect(wm.style.bottom).not.toBe("");
    expect(wm.style.right).not.toBe("");
    expect(wm.style.top).toBe("");
    expect(wm.style.left).toBe("");
  });

  it("position top-left places the overlay top + left", async () => {
    const ctx = makeContext({
      watermark: { enabled: true, text: "x", position: "top-left" },
    });
    await watermarkPlugin.init(ctx);
    const wm = ctx.container.querySelector(".playerstack-watermark") as HTMLElement;
    expect(wm.style.top).not.toBe("");
    expect(wm.style.left).not.toBe("");
    expect(wm.style.bottom).toBe("");
    expect(wm.style.right).toBe("");
  });

  it("clamps opacity to [0, 1] and falls back to default when invalid", async () => {
    const cases: Array<[unknown, string]> = [
      [0.5, "0.5"],
      [-1, "0"],
      [2, "1"],
      ["not-a-number", "0.7"],
      [Number.NaN, "0.7"],
    ];
    for (const [input, expected] of cases) {
      document.body.innerHTML = "";
      const ctx = makeContext({
        watermark: { enabled: true, text: "x", opacity: input as number },
      });
      await watermarkPlugin.init(ctx);
      const wm = ctx.container.querySelector(".playerstack-watermark") as HTMLElement;
      expect(wm.style.opacity).toBe(expected);
    }
  });

  it("wraps the overlay in an <a> when href is provided (target=_blank, rel=noopener)", async () => {
    const ctx = makeContext({
      watermark: { enabled: true, src: "https://example.com/logo.png", href: "https://acme.test" },
    });
    await watermarkPlugin.init(ctx);
    const link = ctx.container.querySelector("a.playerstack-watermark") as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.href).toBe("https://acme.test/");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(link.querySelector("img")).not.toBeNull();
  });

  it("does not wrap in <a> when href is not an http(s) URL", async () => {
    const ctx = makeContext({
      watermark: {
        enabled: true,
        text: "x",
        href: "javascript:x" as string,
      },
    });
    await watermarkPlugin.init(ctx);
    const wm = ctx.container.querySelector(".playerstack-watermark");
    expect(wm).not.toBeNull();
    expect(wm!.tagName).not.toBe("A");
  });

  it("does not render an <img> when watermark.src is not an http(s) URL", async () => {
    const ctx = makeContext({
      watermark: { enabled: true, src: "javascript:x" as string },
    });
    await watermarkPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-watermark img")).toBeNull();
    expect(ctx.container.querySelector(".playerstack-watermark")).toBeNull();
  });

  it("falls back to text mode when src is invalid but text is present", async () => {
    const ctx = makeContext({
      watermark: { enabled: true, src: "javascript:x" as string, text: "© ACME" },
    });
    await watermarkPlugin.init(ctx);
    const wm = ctx.container.querySelector(".playerstack-watermark");
    expect(wm).not.toBeNull();
    expect(wm?.querySelector("img")).toBeNull();
    expect(wm?.textContent).toBe("© ACME");
  });

  it("destroy removes the overlay", async () => {
    const ctx = makeContext({
      watermark: { enabled: true, text: "© ACME" },
    });
    await watermarkPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-watermark")).not.toBeNull();
    watermarkPlugin.destroy?.(ctx);
    expect(ctx.container.querySelector(".playerstack-watermark")).toBeNull();
  });

  it("mounts the overlay as a direct child of <player-stack> (ctx.container), not inside <media-controller>", async () => {
    // Mux <media-controller> has its own shadow DOM. Mounting watermark
    // there hides it under native UI. Core gives <player-stack> the right
    // anchor styles, so we mount there directly.
    const ctx = makeContext({
      watermark: { enabled: true, text: "x" },
    });
    await watermarkPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-watermark");
    expect(overlay?.parentElement).toBe(ctx.container);
  });

  it("custom width is applied to image (in px)", async () => {
    const ctx = makeContext({
      watermark: { enabled: true, src: "https://example.com/logo.png", width: 120 },
    });
    await watermarkPlugin.init(ctx);
    const img = ctx.container.querySelector(".playerstack-watermark img") as HTMLImageElement;
    expect(img.style.width).toBe("120px");
  });

  it("custom margin is applied to corner offsets", async () => {
    const ctx = makeContext({
      watermark: { enabled: true, text: "x", margin: 32, position: "top-right" },
    });
    await watermarkPlugin.init(ctx);
    const wm = ctx.container.querySelector(".playerstack-watermark") as HTMLElement;
    expect(wm.style.top).toBe("32px");
    expect(wm.style.right).toBe("32px");
  });

  it.each(["bottom-left", "bottom-right"])(
    "keeps a %s overlay clear of the control bar, honouring a larger margin",
    async (position) => {
      for (const [margin, expected] of [
        [undefined, "16px"],
        [80, "80px"],
      ] as const) {
        document.body.innerHTML = "";
        const ctx = makeContext({ watermark: { enabled: true, text: "x", position, margin } });
        await watermarkPlugin.init(ctx);
        const wm = ctx.container.querySelector(".playerstack-watermark") as HTMLElement;
        expect(wm.style.bottom).toBe(
          `calc(max(${expected}, var(--ps-control-bar-clearance, 48px)))`,
        );
      }
    },
  );

  it("takes pointer events only when it is a link", async () => {
    for (const [href, expected] of [
      [undefined, "none"],
      ["https://acme.test", "auto"],
    ] as const) {
      document.body.innerHTML = "";
      const ctx = makeContext({ watermark: { enabled: true, text: "x", href } });
      await watermarkPlugin.init(ctx);
      const wm = ctx.container.querySelector(".playerstack-watermark") as HTMLElement;
      expect(wm.style.pointerEvents).toBe(expected);
    }
  });
});

describe("watermarkPlugin moveInterval", () => {
  const started: PlayerstackContext[] = [];

  async function start(extra: Record<string, unknown> = {}) {
    const ctx = makeContext({ watermark: { enabled: true, text: "x", ...extra } });
    await watermarkPlugin.init(ctx);
    started.push(ctx);
    return ctx.container.querySelector(".playerstack-watermark") as HTMLElement;
  }
  const spot = (el: HTMLElement) => [el.style.left, el.style.top, el.style.transform];
  const reducedMotion = (matches: boolean) =>
    vi.stubGlobal("matchMedia", () => ({ matches }) as MediaQueryList);

  beforeEach(() => {
    vi.useFakeTimers();
    reducedMotion(false);
  });
  afterEach(() => {
    for (const ctx of started.splice(0)) watermarkPlugin.destroy?.(ctx);
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stays in its corner without moveInterval", async () => {
    const wm = await start();
    vi.advanceTimersByTime(60_000);
    expect(wm.style.bottom).not.toBe("");
    expect(wm.style.right).not.toBe("");
    expect(wm.style.left).toBe("");
    expect(wm.style.transition).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts at a random spot inside the frame, above the control bar", async () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.25).mockReturnValueOnce(0.75);
    const wm = await start({ moveInterval: 10, position: "top-right", margin: 20 });
    expect(spot(wm)).toEqual([
      "calc(20px + (100% - 2 * 20px) * 0.25)",
      "calc(20px + (100% - 20px - max(20px, var(--ps-control-bar-clearance, 48px))) * 0.75)",
      "translate(-25%, -75%)",
    ]);
    expect(wm.style.right).toBe("");
    expect(wm.style.bottom).toBe("");
  });

  it("keeps its natural width wherever it lands", async () => {
    const wm = await start({ moveInterval: 10 });
    expect(wm.style.width).toBe("max-content");
    expect(wm.style.maxWidth).toBe("calc(100% - 2 * 16px)");
    expect(wm.style.overflowWrap).toBe("anywhere");
  });

  it("moves once per interval", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const wm = await start({ moveInterval: 5 });
    const first = spot(wm);
    random.mockReturnValue(0.5);
    vi.advanceTimersByTime(4999);
    expect(spot(wm)).toEqual(first);
    vi.advanceTimersByTime(1);
    expect(wm.style.transform).toBe("translate(-50%, -50%)");
    random.mockReturnValue(1);
    vi.advanceTimersByTime(5000);
    expect(wm.style.transform).toBe("translate(-100%, -100%)");
  });

  it("does not move more often than once a second", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const wm = await start({ moveInterval: 0.05 });
    random.mockReturnValue(0.5);
    vi.advanceTimersByTime(999);
    expect(wm.style.transform).toBe("translate(0%, 0%)");
    vi.advanceTimersByTime(1);
    expect(wm.style.transform).toBe("translate(-50%, -50%)");
  });

  it("caps an interval too long for a browser timer", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const wm = await start({ moveInterval: 1e12 });
    random.mockReturnValue(0.5);
    vi.advanceTimersByTime(60_000);
    expect(wm.style.transform).toBe("translate(0%, 0%)");
  });

  it.each([0, -5, Number.NaN, "10"])("ignores moveInterval %s", async (moveInterval) => {
    const wm = await start({ moveInterval });
    expect(wm.style.left).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("glides between spots by default, but not into the first one", async () => {
    const wm = await start({ moveInterval: 5 });
    expect(wm.style.transition).toBe("");
    vi.advanceTimersByTime(5000);
    expect(wm.style.transition).toBe("left 0.8s ease, top 0.8s ease, transform 0.8s ease");
  });

  it("jumps with moveTransition jump", async () => {
    const wm = await start({ moveInterval: 5, moveTransition: "jump" });
    vi.advanceTimersByTime(5000);
    expect(wm.style.transition).toBe("none");
  });

  it("jumps while the viewer prefers reduced motion", async () => {
    const wm = await start({ moveInterval: 5 });
    reducedMotion(true);
    vi.advanceTimersByTime(5000);
    expect(wm.style.transition).toBe("none");
    reducedMotion(false);
    vi.advanceTimersByTime(5000);
    expect(wm.style.transition).toContain("0.8s");
  });

  it("destroy stops the timer", async () => {
    await start({ moveInterval: 5 });
    watermarkPlugin.destroy?.(started.pop()!);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("watermarkPlugin reinsert", () => {
  const mutations = () => new Promise((resolve) => setTimeout(resolve, 0));

  async function start(extra: Record<string, unknown> = {}) {
    const ctx = makeContext({ watermark: { enabled: true, text: "x", ...extra } });
    await watermarkPlugin.init(ctx);
    const wm = ctx.container.querySelector(".playerstack-watermark") as HTMLElement;
    return { ctx, wm };
  }

  it("leaves a removed overlay removed by default", async () => {
    const { wm } = await start();
    wm.remove();
    await mutations();
    expect(wm.isConnected).toBe(false);
  });

  it("puts the overlay back each time it is removed", async () => {
    const { ctx, wm } = await start({ reinsert: true });
    for (let i = 0; i < 2; i++) {
      wm.remove();
      await mutations();
      expect(wm.parentElement).toBe(ctx.container);
    }
    expect(ctx.container.querySelectorAll(".playerstack-watermark")).toHaveLength(1);
    watermarkPlugin.destroy?.(ctx);
  });

  it("brings the overlay back after it is moved elsewhere", async () => {
    const { ctx, wm } = await start({ reinsert: true });
    document.body.appendChild(wm);
    await mutations();
    expect(wm.parentElement).toBe(ctx.container);
    watermarkPlugin.destroy?.(ctx);
  });

  it("destroy removes the overlay for good", async () => {
    const { ctx, wm } = await start({ reinsert: true });
    watermarkPlugin.destroy?.(ctx);
    await mutations();
    expect(wm.isConnected).toBe(false);
  });
});
