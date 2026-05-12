import { afterEach, describe, expect, it, vi } from "vitest";
import { introCardPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const mediaPlayer = document.createElement("video") as HTMLElement & {
    play: () => Promise<void>;
  };
  mediaPlayer.play = vi.fn(() => Promise.resolve());
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

describe("introCardPlugin", () => {
  it("has a stable name", () => {
    expect(introCardPlugin.name).toBe("intro-card");
  });

  it("does nothing when not enabled", async () => {
    const ctx = makeContext();
    await introCardPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-intro-card")).toBeNull();
  });

  it("renders the overlay when enabled", async () => {
    const ctx = makeContext({ introCard: { enabled: true, title: "Welcome" } });
    await introCardPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-intro-card")).not.toBeNull();
  });

  it("renders title, subtitle, and badge", async () => {
    const ctx = makeContext({
      introCard: {
        enabled: true,
        badge: "FREE PREVIEW",
        title: "Lesson 1",
        subtitle: "5 minutes — kick-off",
      },
    });
    await introCardPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-intro-card") as HTMLElement;
    expect(overlay.textContent).toContain("FREE PREVIEW");
    expect(overlay.textContent).toContain("Lesson 1");
    expect(overlay.textContent).toContain("5 minutes — kick-off");
    expect(overlay.querySelector(".playerstack-intro-card-badge")?.textContent).toBe(
      "FREE PREVIEW",
    );
    expect(overlay.querySelector(".playerstack-intro-card-title")?.textContent).toBe("Lesson 1");
    expect(overlay.querySelector(".playerstack-intro-card-subtitle")?.textContent).toBe(
      "5 minutes — kick-off",
    );
  });

  it("renders custom html via innerHTML when html field is set", async () => {
    const ctx = makeContext({
      introCard: {
        enabled: true,
        html: "<p data-test='custom'>Custom <em>marketing</em> copy</p>",
      },
    });
    await introCardPlugin.init(ctx);
    const custom = ctx.container.querySelector("[data-test='custom']");
    expect(custom).not.toBeNull();
    expect(custom?.querySelector("em")?.textContent).toBe("marketing");
  });

  it("renders the big play button (SVG, not unicode)", async () => {
    const ctx = makeContext({ introCard: { enabled: true } });
    await introCardPlugin.init(ctx);
    const btn = ctx.container.querySelector(".playerstack-intro-card-play") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.querySelector("svg")).not.toBeNull();
    expect(btn.textContent?.trim()).toBe("");
  });

  it("clicking the play button calls mediaPlayer.play() and removes the overlay", async () => {
    const ctx = makeContext({ introCard: { enabled: true, title: "Watch" } });
    await introCardPlugin.init(ctx);
    const btn = ctx.container.querySelector(".playerstack-intro-card-play") as HTMLButtonElement;
    btn.click();
    expect(
      (ctx.mediaPlayer as unknown as { play: ReturnType<typeof vi.fn> }).play,
    ).toHaveBeenCalledTimes(1);
    expect(ctx.container.querySelector(".playerstack-intro-card")).toBeNull();
  });

  it("emits intro-card:play-click on play button click", async () => {
    const ctx = makeContext({ introCard: { enabled: true } });
    const handler = vi.fn();
    ctx.events.on("intro-card:play-click", handler);
    await introCardPlugin.init(ctx);
    (ctx.container.querySelector(".playerstack-intro-card-play") as HTMLElement).click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("renders a CTA link when cta is configured (target=_blank, rel=noopener)", async () => {
    const ctx = makeContext({
      introCard: {
        enabled: true,
        cta: { label: "Buy course", url: "https://example.com/course" },
      },
    });
    await introCardPlugin.init(ctx);
    const cta = ctx.container.querySelector("a.playerstack-intro-card-cta") as HTMLAnchorElement;
    expect(cta).not.toBeNull();
    expect(cta.href).toBe("https://example.com/course");
    expect(cta.target).toBe("_blank");
    expect(cta.rel).toContain("noopener");
    expect(cta.textContent).toContain("Buy course");
  });

  it("appends utm to CTA url when provided", async () => {
    const ctx = makeContext({
      introCard: {
        enabled: true,
        cta: {
          label: "Open",
          url: "https://example.com/course",
          utm: "utm_source=intro&utm_medium=video",
        },
      },
    });
    await introCardPlugin.init(ctx);
    const cta = ctx.container.querySelector("a.playerstack-intro-card-cta") as HTMLAnchorElement;
    expect(cta.href).toContain("utm_source=intro");
    expect(cta.href).toContain("utm_medium=video");
  });

  it("rejects CTA with non-http(s) url (link not rendered)", async () => {
    const ctx = makeContext({
      introCard: {
        enabled: true,
        cta: { label: "x", url: "javascript:alert(1)" },
      },
    });
    await introCardPlugin.init(ctx);
    expect(ctx.container.querySelector("a.playerstack-intro-card-cta")).toBeNull();
  });

  it("emits intro-card:cta-click on CTA click WITHOUT calling play() or removing overlay", async () => {
    const ctx = makeContext({
      introCard: {
        enabled: true,
        cta: { label: "Buy", url: "https://example.com/course" },
      },
    });
    const handler = vi.fn();
    ctx.events.on("intro-card:cta-click", handler);
    await introCardPlugin.init(ctx);
    const cta = ctx.container.querySelector("a.playerstack-intro-card-cta") as HTMLAnchorElement;
    // jsdom-style click (target=_blank actually opens in real browser; we just
    // assert the event semantics here).
    cta.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(
      (ctx.mediaPlayer as unknown as { play: ReturnType<typeof vi.fn> }).play,
    ).not.toHaveBeenCalled();
    // Overlay must remain so the user can come back and click play.
    expect(ctx.container.querySelector(".playerstack-intro-card")).not.toBeNull();
  });

  it("when dismissible: shows close button, click closes overlay WITHOUT play", async () => {
    const ctx = makeContext({
      introCard: { enabled: true, dismissible: true },
    });
    const dismiss = vi.fn();
    ctx.events.on("intro-card:dismiss", dismiss);
    await introCardPlugin.init(ctx);
    const close = ctx.container.querySelector(".playerstack-intro-card-close") as HTMLButtonElement;
    expect(close).not.toBeNull();
    close.click();
    expect(ctx.container.querySelector(".playerstack-intro-card")).toBeNull();
    expect(
      (ctx.mediaPlayer as unknown as { play: ReturnType<typeof vi.fn> }).play,
    ).not.toHaveBeenCalled();
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("when not dismissible (default): no close button is rendered", async () => {
    const ctx = makeContext({ introCard: { enabled: true } });
    await introCardPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-intro-card-close")).toBeNull();
  });

  it("supports position fullscreen / bottom / center via data-position attribute", async () => {
    for (const position of ["fullscreen", "bottom", "center"] as const) {
      document.body.innerHTML = "";
      const ctx = makeContext({ introCard: { enabled: true, position } });
      await introCardPlugin.init(ctx);
      const overlay = ctx.container.querySelector(".playerstack-intro-card") as HTMLElement;
      expect(overlay.getAttribute("data-position")).toBe(position);
    }
  });

  it("supports theme dark / light / transparent via data-theme attribute", async () => {
    for (const theme of ["dark", "light", "transparent"] as const) {
      document.body.innerHTML = "";
      const ctx = makeContext({ introCard: { enabled: true, theme } });
      await introCardPlugin.init(ctx);
      const overlay = ctx.container.querySelector(".playerstack-intro-card") as HTMLElement;
      expect(overlay.getAttribute("data-theme")).toBe(theme);
    }
  });

  it("renders an image as background when image URL is provided", async () => {
    const ctx = makeContext({
      introCard: { enabled: true, image: "https://example.com/bg.jpg", title: "x" },
    });
    await introCardPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-intro-card") as HTMLElement;
    const img = overlay.querySelector("img.playerstack-intro-card-bg") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe("https://example.com/bg.jpg");
    expect(img.alt).toBe("");
  });

  it("destroy removes the overlay", async () => {
    const ctx = makeContext({ introCard: { enabled: true, title: "x" } });
    await introCardPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-intro-card")).not.toBeNull();
    introCardPlugin.destroy?.(ctx);
    expect(ctx.container.querySelector(".playerstack-intro-card")).toBeNull();
  });

  it("introCard.html is rendered through the core sanitizer (non-whitelisted tags removed)", async () => {
    const ctx = makeContext({
      introCard: {
        enabled: true,
        html: '<em>safe</em><script>x()</script><img src=x onerror="x()"><iframe src="https://example.com"></iframe>',
      },
    });
    await introCardPlugin.init(ctx);
    const wrap = ctx.container.querySelector(".playerstack-intro-card-html");
    const html = wrap?.innerHTML ?? "";
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/<iframe/i);
    expect(html).toContain("<em>safe</em>");
  });

  it("does not render the background <img> when image URL is not http(s)", async () => {
    const ctx = makeContext({
      introCard: { enabled: true, image: "javascript:x", title: "x" },
    });
    await introCardPlugin.init(ctx);
    expect(ctx.container.querySelector("img.playerstack-intro-card-bg")).toBeNull();
  });

  it("mounts the overlay as a direct child of <player-stack> (ctx.container), not inside <media-controller>", async () => {
    // Mux <media-controller> has its own shadow DOM with internal z-index for
    // native UI. Mounting overlay there can hide it under controls. Core sets
    // position:relative + aspect-ratio + overflow on <player-stack>, so it's
    // the safe anchor for absolute overlays.
    const ctx = makeContext({ introCard: { enabled: true } });
    await introCardPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-intro-card");
    expect(overlay?.parentElement).toBe(ctx.container);
  });
});
