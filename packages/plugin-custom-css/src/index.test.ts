import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
      customCss: {
        enabled: false,
        trustedCss: "& video { filter: grayscale(1); }",
        acknowledgeTrusted: true,
      },
    });
    await customCssPlugin.init(ctx);
    expect(document.head.querySelector('style[data-playerstack="custom-css"]')).toBeNull();
  });

  describe("tokens", () => {
    it("applies validated --ps-* tokens as inline custom properties on the container", async () => {
      const ctx = makeContext({
        customCss: {
          enabled: true,
          tokens: { "--ps-accent": "#008aff", "--ps-radius": "8px" },
        },
      });
      await customCssPlugin.init(ctx);
      expect(ctx.container.style.getPropertyValue("--ps-accent")).toBe("#008aff");
      expect(ctx.container.style.getPropertyValue("--ps-radius")).toBe("8px");
    });

    it("drops tokens whose name does not match --ps-*", async () => {
      const ctx = makeContext({
        customCss: {
          enabled: true,
          tokens: { "--evil": "red", "background-color": "red", "--ps-accent": "blue" },
        },
      });
      await customCssPlugin.init(ctx);
      expect(ctx.container.style.getPropertyValue("--evil")).toBe("");
      expect(ctx.container.style.getPropertyValue("background-color")).toBe("");
      expect(ctx.container.style.getPropertyValue("--ps-accent")).toBe("blue");
    });

    it("drops tokens whose value contains url(, @, ;, {, or <", async () => {
      const ctx = makeContext({
        customCss: {
          enabled: true,
          tokens: {
            "--ps-a": "url(https://example.com/x.png)",
            "--ps-b": "red; background: url(x)",
            "--ps-c": "blue} body { background: red",
            "--ps-d": "@import 'remote'",
            "--ps-e": "</style><x>",
            "--ps-f": "javascript:x",
            "--ps-ok": "rgb(0,128,255)",
          },
        },
      });
      await customCssPlugin.init(ctx);
      for (const bad of ["--ps-a", "--ps-b", "--ps-c", "--ps-d", "--ps-e", "--ps-f"]) {
        expect(ctx.container.style.getPropertyValue(bad)).toBe("");
      }
      expect(ctx.container.style.getPropertyValue("--ps-ok")).toBe("rgb(0,128,255)");
    });

    it("destroy removes the applied tokens", async () => {
      const ctx = makeContext({
        customCss: { enabled: true, tokens: { "--ps-accent": "#008aff" } },
      });
      await customCssPlugin.init(ctx);
      expect(ctx.container.style.getPropertyValue("--ps-accent")).toBe("#008aff");
      customCssPlugin.destroy?.(ctx);
      expect(ctx.container.style.getPropertyValue("--ps-accent")).toBe("");
    });
  });

  describe("trustedCss + acknowledgeTrusted", () => {
    it("injects a scoped <style> when trustedCss is present and acknowledgeTrusted=true", async () => {
      const ctx = makeContext({
        customCss: {
          enabled: true,
          trustedCss: "& video { filter: grayscale(1); }",
          acknowledgeTrusted: true,
        },
      });
      await customCssPlugin.init(ctx);
      const style = document.head.querySelector(
        'style[data-playerstack="custom-css"]',
      ) as HTMLStyleElement;
      expect(style).not.toBeNull();
      expect(style.textContent).toContain("filter: grayscale(1)");
    });

    it("scopes the css with player-stack:has([data-ps-id='…'])", async () => {
      const ctx = makeContext({
        customCss: {
          enabled: true,
          trustedCss: "& video { filter: grayscale(1); }",
          acknowledgeTrusted: true,
        },
      });
      await customCssPlugin.init(ctx);
      const id = ctx.mediaPlayer.getAttribute("data-ps-id");
      expect(id).not.toBeNull();
      const style = document.head.querySelector(
        'style[data-playerstack="custom-css"]',
      ) as HTMLStyleElement;
      expect(style.textContent).toContain(`player-stack:has([data-ps-id="${id}"])`);
    });

    it("does not apply trustedCss without acknowledgeTrusted, and warns", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const ctx = makeContext({
        customCss: {
          enabled: true,
          trustedCss: "& video { filter: grayscale(1); }",
        },
      });
      await customCssPlugin.init(ctx);
      expect(document.head.querySelector('style[data-playerstack="custom-css"]')).toBeNull();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("destroy removes the injected <style>", async () => {
      const ctx = makeContext({
        customCss: {
          enabled: true,
          trustedCss: "& video { filter: grayscale(1); }",
          acknowledgeTrusted: true,
        },
      });
      await customCssPlugin.init(ctx);
      expect(document.head.querySelector('style[data-playerstack="custom-css"]')).not.toBeNull();
      customCssPlugin.destroy?.(ctx);
      expect(document.head.querySelector('style[data-playerstack="custom-css"]')).toBeNull();
    });
  });

  describe("deprecated css field", () => {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
    });

    it("does NOT inject when only `css` is provided (must also set acknowledgeTrusted)", async () => {
      const ctx = makeContext({
        customCss: { enabled: true, css: "& video { filter: blur(2px); }" },
      });
      await customCssPlugin.init(ctx);
      expect(document.head.querySelector('style[data-playerstack="custom-css"]')).toBeNull();
      expect(warn).toHaveBeenCalled();
    });

    it("still injects when both legacy `css` and `acknowledgeTrusted: true` are set", async () => {
      const ctx = makeContext({
        customCss: {
          enabled: true,
          css: "& video { filter: blur(2px); }",
          acknowledgeTrusted: true,
        },
      });
      await customCssPlugin.init(ctx);
      expect(document.head.querySelector('style[data-playerstack="custom-css"]')).not.toBeNull();
      expect(warn).toHaveBeenCalled();
    });
  });

  describe("sanitizer floor still applies under acknowledgeTrusted", () => {
    it("does not inject when input contains @import, </style>, expression(, javascript:, url(, @font-face, @namespace", async () => {
      const cases = [
        "@import url('https://example.com/styles.css');",
        "color: red; </style><x>",
        "color: expression(x);",
        "background: url(javascript:x);",
        "background: url('https://example.com/pixel.gif');",
        "@font-face { font-family: x; src: url('https://example.com/font.woff2'); }",
        "@namespace svg url('http://www.w3.org/2000/svg');",
      ];
      for (const css of cases) {
        document.body.innerHTML = "";
        document.head
          .querySelectorAll('style[data-playerstack="custom-css"]')
          .forEach((s) => s.remove());
        const ctx = makeContext({
          customCss: { enabled: true, trustedCss: css, acknowledgeTrusted: true },
        });
        await customCssPlugin.init(ctx);
        expect(document.head.querySelector('style[data-playerstack="custom-css"]')).toBeNull();
      }
    });
  });

  it("two independent contexts get independent scopes", async () => {
    const ctxA = makeContext({
      customCss: {
        enabled: true,
        trustedCss: "& video { filter: grayscale(1); }",
        acknowledgeTrusted: true,
      },
    });
    const ctxB = makeContext({
      customCss: {
        enabled: true,
        trustedCss: "& video { filter: blur(2px); }",
        acknowledgeTrusted: true,
      },
    });
    await customCssPlugin.init(ctxA);
    await customCssPlugin.init(ctxB);
    const styles = document.head.querySelectorAll('style[data-playerstack="custom-css"]');
    expect(styles.length).toBe(2);
    const idA = ctxA.mediaPlayer.getAttribute("data-ps-id");
    const idB = ctxB.mediaPlayer.getAttribute("data-ps-id");
    expect(idA).not.toBe(idB);
  });

  it("reuses an existing data-ps-id (e.g. set by controls-policy) instead of creating a new one", async () => {
    const ctx = makeContext({
      customCss: {
        enabled: true,
        trustedCss: "& video { filter: blur(2px); }",
        acknowledgeTrusted: true,
      },
    });
    ctx.mediaPlayer.setAttribute("data-ps-id", "ps-existing");
    await customCssPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("data-ps-id")).toBe("ps-existing");
    const style = document.head.querySelector(
      'style[data-playerstack="custom-css"]',
    ) as HTMLStyleElement;
    expect(style.textContent).toContain('player-stack:has([data-ps-id="ps-existing"])');
  });

  it("does not strip the data-ps-id on destroy if another plugin or external code set it", async () => {
    const ctx = makeContext({
      customCss: {
        enabled: true,
        trustedCss: "& video { filter: blur(2px); }",
        acknowledgeTrusted: true,
      },
    });
    ctx.mediaPlayer.setAttribute("data-ps-id", "ps-shared");
    await customCssPlugin.init(ctx);
    customCssPlugin.destroy?.(ctx);
    expect(ctx.mediaPlayer.getAttribute("data-ps-id")).toBe("ps-shared");
  });
});
