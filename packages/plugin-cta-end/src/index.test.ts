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
  it("keeps long end cards in their own scroll area with reachable first and last actions", async () => {
    const ctx = makeContext({
      ctaEnd: {
        enabled: true,
        title: "Long title ".repeat(30),
        button: { label: "Offer", url: "https://example.com" },
        showReplay: true,
      },
    });
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    const overlay = ctx.container.querySelector<HTMLElement>(".playerstack-cta")!;
    expect(overlay.style.overflowY).toBe("auto");
    expect(overlay.style.getPropertyValue("overscroll-behavior")).toBe("contain");
    expect(overlay.style.boxSizing).toBe("border-box");
    expect(overlay.style.justifyContent).toBe("flex-start");
    expect((overlay.firstElementChild as HTMLElement).style.marginTop).toBe("auto");
    expect((overlay.lastElementChild as HTMLElement).style.marginBottom).toBe("auto");
    expect((overlay.lastElementChild as HTMLElement).style.flexShrink).toBe("0");
    ctaEndPlugin.destroy?.(ctx);
  });
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
  it("uses replayLabel for the replay button text (default: Replay)", async () => {
    const ctx = makeContext({
      ctaEnd: { enabled: true, showReplay: true, replayLabel: "Obejrzyj jeszcze raz" },
    });
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    expect(ctx.container.querySelector(".playerstack-cta-replay")?.textContent).toBe(
      "Obejrzyj jeszcze raz",
    );
  });
  it("title keeps the overlay text color even when the host page styles headings", async () => {
    const ctx = makeContext({ ctaEnd: { enabled: true, title: "Done" } });
    await ctaEndPlugin.init(ctx);
    fireEnded(ctx.mediaPlayer);
    const title = ctx.container.querySelector(".playerstack-cta h3") as HTMLElement;
    expect(title.style.color).toBe("inherit");
  });
});

it("covers controls, focuses CTA, restarts at zero and returns focus to play", async () => {
  const ctx = makeContext({
    ctaEnd: {
      enabled: true,
      showReplay: true,
      button: { label: "CTA", url: "https://example.com" },
    },
  });
  document.body.append(ctx.container);
  const controller = document.createElement("media-controller");
  controller.tabIndex = 0;
  const play = document.createElement("media-play-button");
  play.tabIndex = 0;
  ctx.container.append(controller);
  controller.append(ctx.mediaPlayer, play);
  Object.assign(ctx.mediaPlayer, { currentTime: 12 });
  play.focus();
  await ctaEndPlugin.init(ctx);
  fireEnded(ctx.mediaPlayer);
  expect(controller.hasAttribute("inert")).toBe(true);
  expect(document.activeElement).toBe(ctx.container.querySelector("a"));
  (ctx.container.querySelector(".playerstack-cta-replay") as HTMLElement).click();
  expect(controller.hasAttribute("inert")).toBe(false);
  expect((ctx.mediaPlayer as HTMLVideoElement).currentTime).toBe(0);
  expect(document.activeElement).toBe(play);
  ctaEndPlugin.destroy?.(ctx);
  ctx.container.remove();
});
