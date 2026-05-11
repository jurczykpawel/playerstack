import { afterEach, describe, expect, it } from "vitest";
import { customCssPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  // Use a plain div as the container in tests to avoid triggering the real
  // <player-stack> custom-element boot (which would log a "missing src" warning).
  const container = document.createElement("div") as HTMLElement;
  document.body.appendChild(container);
  const mediaPlayer = document.createElement("video") as HTMLElement;
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
  document.head.querySelectorAll('style[data-playerstack="custom-css"]').forEach((s) => s.remove());
});

describe("customCssPlugin", () => {
  it("has a stable name", () => {
    expect(customCssPlugin.name).toBe("custom-css");
  });

  it("does nothing when no customCss config", async () => {
    const ctx = makeContext();
    await customCssPlugin.init(ctx);
    expect(document.head.querySelector('style[data-playerstack="custom-css"]')).toBeNull();
  });

  it("does nothing when disabled", async () => {
    const ctx = makeContext({
      customCss: { enabled: false, css: "& video { filter: grayscale(1); }" },
    });
    await customCssPlugin.init(ctx);
    expect(document.head.querySelector('style[data-playerstack="custom-css"]')).toBeNull();
  });

  it("does nothing when css is empty / whitespace-only", async () => {
    for (const css of ["", "   \n\t  "]) {
      document.body.innerHTML = "";
      document.head
        .querySelectorAll('style[data-playerstack="custom-css"]')
        .forEach((s) => s.remove());
      const ctx = makeContext({ customCss: { enabled: true, css } });
      await customCssPlugin.init(ctx);
      expect(document.head.querySelector('style[data-playerstack="custom-css"]')).toBeNull();
    }
  });

  it("injects a scoped <style> in <head> when enabled with safe css", async () => {
    const ctx = makeContext({
      customCss: { enabled: true, css: "& video { filter: grayscale(1); }" },
    });
    await customCssPlugin.init(ctx);
    const style = document.head.querySelector(
      'style[data-playerstack="custom-css"]',
    ) as HTMLStyleElement;
    expect(style).not.toBeNull();
    expect(style.textContent).toContain("filter: grayscale(1)");
  });

  it("scopes the css with player-stack:has([data-ps-id='…']) so it matches the ancestor", async () => {
    // data-ps-id sits on the inner mediaPlayer element (matching controls-policy
    // convention). A bare attribute selector on <player-stack> wouldn't match;
    // :has() is the correct construct.
    const ctx = makeContext({
      customCss: { enabled: true, css: "& video { filter: grayscale(1); }" },
    });
    await customCssPlugin.init(ctx);
    const id = ctx.mediaPlayer.getAttribute("data-ps-id");
    expect(id).not.toBeNull();
    const style = document.head.querySelector(
      'style[data-playerstack="custom-css"]',
    ) as HTMLStyleElement;
    expect(style.textContent).toContain(`player-stack:has([data-ps-id="${id}"])`);
  });

  it("reuses an existing data-ps-id (e.g. set by controls-policy) instead of creating a new one", async () => {
    const ctx = makeContext({
      customCss: { enabled: true, css: "& video { filter: blur(2px); }" },
    });
    ctx.mediaPlayer.setAttribute("data-ps-id", "ps-existing");
    await customCssPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("data-ps-id")).toBe("ps-existing");
    const style = document.head.querySelector(
      'style[data-playerstack="custom-css"]',
    ) as HTMLStyleElement;
    expect(style.textContent).toContain('player-stack:has([data-ps-id="ps-existing"])');
  });

  it("two independent contexts get independent scopes", async () => {
    const ctxA = makeContext({
      customCss: { enabled: true, css: "& video { filter: grayscale(1); }" },
    });
    const ctxB = makeContext({
      customCss: { enabled: true, css: "& video { filter: blur(2px); }" },
    });
    await customCssPlugin.init(ctxA);
    await customCssPlugin.init(ctxB);
    const styles = document.head.querySelectorAll('style[data-playerstack="custom-css"]');
    expect(styles.length).toBe(2);
    const idA = ctxA.mediaPlayer.getAttribute("data-ps-id");
    const idB = ctxB.mediaPlayer.getAttribute("data-ps-id");
    expect(idA).not.toBe(idB);
  });

  it("destroy removes the <style> from <head>", async () => {
    const ctx = makeContext({
      customCss: { enabled: true, css: "& video { filter: grayscale(1); }" },
    });
    await customCssPlugin.init(ctx);
    expect(document.head.querySelector('style[data-playerstack="custom-css"]')).not.toBeNull();
    customCssPlugin.destroy?.(ctx);
    expect(document.head.querySelector('style[data-playerstack="custom-css"]')).toBeNull();
  });

  it("rejects unsafe css (no <style> created): @import, </style>, expression(, javascript:", async () => {
    const cases = [
      "@import url('https://evil.test/styles.css');",
      "color: red; </style><script>alert(1)</script>",
      "color: expression(alert(1));",
      "background: url(javascript:alert(1));",
    ];
    for (const css of cases) {
      document.body.innerHTML = "";
      document.head
        .querySelectorAll('style[data-playerstack="custom-css"]')
        .forEach((s) => s.remove());
      const ctx = makeContext({ customCss: { enabled: true, css } });
      await customCssPlugin.init(ctx);
      expect(document.head.querySelector('style[data-playerstack="custom-css"]')).toBeNull();
    }
  });

  it("does not strip the data-ps-id on destroy if another plugin or external code set it", async () => {
    const ctx = makeContext({
      customCss: { enabled: true, css: "& video { filter: blur(2px); }" },
    });
    ctx.mediaPlayer.setAttribute("data-ps-id", "ps-shared");
    await customCssPlugin.init(ctx);
    customCssPlugin.destroy?.(ctx);
    expect(ctx.mediaPlayer.getAttribute("data-ps-id")).toBe("ps-shared");
  });
});
