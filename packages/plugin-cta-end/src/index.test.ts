import { describe, expect, it, vi } from "vitest";
import { ctaEndPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  const mediaPlayer = document.createElement("media-player") as unknown as HTMLElement & {
    play: ReturnType<typeof vi.fn>;
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

function fireEnded(mediaPlayer: HTMLElement): void {
  mediaPlayer.dispatchEvent(new CustomEvent("ended"));
}

describe("ctaEndPlugin", () => {
  it("has a stable name", () => {
    expect(ctaEndPlugin.name).toBe("cta-end");
  });

  it("does nothing when ctaEnd is not enabled", async () => {
    const ctx = makeContext();
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    expect(ctx.container.querySelector(".playerstack-cta")).toBeNull();
  });

  it("renders overlay when video ends", async () => {
    const ctx = makeContext({
      ctaEnd: { enabled: true, title: "Thanks for watching!" },
    });
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    const overlay = ctx.container.querySelector(".playerstack-cta");
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain("Thanks for watching!");
  });

  it("renders custom HTML when ctaEnd.html is provided", async () => {
    const ctx = makeContext({
      ctaEnd: { enabled: true, html: "<p class='custom'>Hello</p>" },
    });
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    expect(ctx.container.querySelector(".custom")).not.toBeNull();
  });

  it("renders a button with label and url when configured", async () => {
    const ctx = makeContext({
      ctaEnd: { enabled: true, button: { label: "Buy now", url: "https://example.com/buy" } },
    });
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    const link = ctx.container.querySelector("a.playerstack-cta-button") as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.textContent).toBe("Buy now");
    expect(link.href).toContain("https://example.com/buy");
  });

  it("appends utm string to url when provided", async () => {
    const ctx = makeContext({
      ctaEnd: {
        enabled: true,
        button: { label: "Buy", url: "https://example.com", utm: "utm_source=playerstack" },
      },
    });
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    const link = ctx.container.querySelector("a.playerstack-cta-button") as HTMLAnchorElement;
    expect(link.href).toContain("utm_source=playerstack");
  });

  it("emits cta:click on event bus when CTA button is clicked", async () => {
    const ctx = makeContext({
      ctaEnd: { enabled: true, button: { label: "Buy", url: "https://example.com" } },
    });
    const handler = vi.fn();
    ctx.events.on("cta:click", handler);
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    const link = ctx.container.querySelector("a.playerstack-cta-button") as HTMLAnchorElement;
    link.click();
    expect(handler).toHaveBeenCalled();
  });

  it("renders a replay button when showReplay is true and replays on click", async () => {
    const ctx = makeContext({
      ctaEnd: { enabled: true, showReplay: true },
    });
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    const replay = ctx.container.querySelector(".playerstack-cta-replay") as HTMLButtonElement;
    expect(replay).not.toBeNull();
    replay.click();
    expect(
      (ctx.mediaPlayer as HTMLElement & { play: ReturnType<typeof vi.fn> }).play,
    ).toHaveBeenCalled();
    expect(ctx.container.querySelector(".playerstack-cta")).toBeNull();
  });

  it("destroy removes the listener so 'ended' no longer renders overlay", async () => {
    const ctx = makeContext({
      ctaEnd: { enabled: true, title: "Done" },
    });
    await ctaEndPlugin.init(ctx);
    ctaEndPlugin.destroy?.(ctx);
    fireEnded(ctx.mediaPlayer);
    expect(ctx.container.querySelector(".playerstack-cta")).toBeNull();
  });

  it("destroy removes any existing overlay too", async () => {
    const ctx = makeContext({
      ctaEnd: { enabled: true, title: "Done" },
    });
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    ctaEndPlugin.destroy?.(ctx);
    expect(ctx.container.querySelector(".playerstack-cta")).toBeNull();
  });

  it("ctaEnd.html is rendered through the core sanitizer (non-whitelisted tags removed)", async () => {
    const ctx = makeContext({
      ctaEnd: {
        enabled: true,
        html: '<p>safe</p><script>x()</script><img src=x onerror="x()"><iframe src="https://example.com"></iframe>',
      },
    });
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    const html = ctx.container.querySelector(".playerstack-cta-html")?.innerHTML ?? "";
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/<iframe/i);
    expect(html).toContain("<p>safe</p>");
  });

  it("does not render the CTA button when url is not http(s)", async () => {
    const ctx = makeContext({
      ctaEnd: { enabled: true, button: { label: "x", url: "javascript:x" } },
    });
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    expect(ctx.container.querySelector("a.playerstack-cta-button")).toBeNull();
  });
});
