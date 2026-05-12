import { afterEach, describe, expect, it } from "vitest";
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
});
