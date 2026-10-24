import { describe, expect, it, vi } from "vitest";
import { brandedThumbPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("player-stack") as HTMLElement;
  // Simulate the real DOM: <player-stack> > <media-controller> > <video>
  const mediaController = document.createElement("media-controller");
  const mediaPlayer = document.createElement("video");
  mediaPlayer.setAttribute("src", "youtube/abc123");
  if (extra.poster) mediaPlayer.setAttribute("poster", extra.poster);
  mediaController.appendChild(mediaPlayer);
  container.appendChild(mediaController);
  document.body.appendChild(container);
  return {
    events: createEventBus(),
    container,
    mediaPlayer,
    config: { src: "https://youtu.be/abc123", ...extra },
  } as PlayerstackContext;
}

describe("brandedThumbPlugin", () => {
  it("exposes one named native button without an interactive wrapper", async () => {
    const ctx = makeContext({ brandedThumb: { enabled: true, playLabel: "Odtwórz film" } });
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    const stops = [overlay, ...overlay.querySelectorAll<HTMLElement>("*")].filter(
      (element) => element.tabIndex >= 0,
    );
    expect(stops).toHaveLength(1);
    expect(overlay.hasAttribute("role")).toBe(false);
    const button = stops[0] as HTMLButtonElement;
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button.getAttribute("aria-label")).toBe("Odtwórz film");
    const play = vi.fn();
    (ctx.mediaPlayer as HTMLVideoElement).play = play;
    const clicked = vi.fn();
    ctx.events.on("thumb:click", clicked);
    button.click();
    expect(play).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(ctx.container.querySelector(".playerstack-thumb")).toBeNull();
  });

  it("makes the controller inert until activation or destroy", async () => {
    for (const action of ["activate", "destroy"]) {
      const ctx = makeContext({ brandedThumb: { enabled: true } });
      const controller = ctx.container.querySelector("media-controller")!;
      await brandedThumbPlugin.init(ctx);
      expect(controller.hasAttribute("inert")).toBe(true);
      if (action === "activate") ctx.container.querySelector<HTMLButtonElement>("button")!.click();
      else brandedThumbPlugin.destroy!(ctx);
      expect(controller.hasAttribute("inert")).toBe(false);
    }
  });

  it("moves focus to play after activation, falling back to the controller", async () => {
    for (const withPlay of [true, false]) {
      const ctx = makeContext({ brandedThumb: { enabled: true } });
      const controller = ctx.container.querySelector<HTMLElement>("media-controller")!;
      controller.tabIndex = 0;
      const play = document.createElement("media-play-button");
      play.tabIndex = 0;
      if (withPlay) controller.appendChild(play);
      await brandedThumbPlugin.init(ctx);
      const button = ctx.container.querySelector<HTMLButtonElement>("button")!;
      button.focus();
      button.click();
      expect(document.activeElement).toBe(withPlay ? play : controller);
    }
  });

  it("leaves mouse activation focus to the browser", async () => {
    const ctx = makeContext({ brandedThumb: { enabled: true } });
    const controller = ctx.container.querySelector<HTMLElement>("media-controller")!;
    const play = document.createElement("media-play-button");
    play.tabIndex = 0;
    controller.appendChild(play);
    await brandedThumbPlugin.init(ctx);
    ctx.container
      .querySelector("button")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(document.activeElement).not.toBe(play);
  });

  it("has a stable name", () => {
    expect(brandedThumbPlugin.name).toBe("branded-thumb");
  });

  it("does nothing when brandedThumb is not enabled", async () => {
    const ctx = makeContext();
    await brandedThumbPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-thumb")).toBeNull();
  });

  it("inserts an overlay with poster image when enabled", async () => {
    const ctx = makeContext({
      poster: "https://cdn.example.com/poster.jpg",
      brandedThumb: { enabled: true },
    });
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb");
    expect(overlay).not.toBeNull();
    const img = overlay?.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example.com/poster.jpg");
  });

  it("inserts a play button with default 'circle' style", async () => {
    const ctx = makeContext({ brandedThumb: { enabled: true } });
    await brandedThumbPlugin.init(ctx);
    const button = ctx.container.querySelector(".playerstack-thumb-play");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("data-style")).toBe("circle");
  });

  it("supports playButtonStyle minimal/box/circle", async () => {
    for (const style of ["minimal", "box", "circle"] as const) {
      const ctx = makeContext({
        brandedThumb: { enabled: true, playButtonStyle: style },
      });
      await brandedThumbPlugin.init(ctx);
      const button = ctx.container.querySelector(".playerstack-thumb-play");
      expect(button?.getAttribute("data-style")).toBe(style);
    }
  });

  it("renders an SVG play triangle (not a unicode glyph)", async () => {
    const ctx = makeContext({ brandedThumb: { enabled: true } });
    await brandedThumbPlugin.init(ctx);
    const button = ctx.container.querySelector(".playerstack-thumb-play") as HTMLElement;
    const svg = button.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    // No fallback unicode glyph in textContent — only the SVG.
    expect(button.textContent?.trim()).toBe("");
  });

  it("default play button is sized for prominent overlay (~84px)", async () => {
    const ctx = makeContext({ brandedThumb: { enabled: true } });
    await brandedThumbPlugin.init(ctx);
    const button = ctx.container.querySelector(".playerstack-thumb-play") as HTMLElement;
    // Specific px values are an implementation detail, but the button MUST be
    // visually prominent. Anything below ~64px is regression territory.
    const widthPx = parseInt(button.style.width, 10);
    expect(widthPx).toBeGreaterThanOrEqual(64);
  });

  it("mounts the overlay as a direct child of <player-stack>, NOT inside media-controller", async () => {
    // Mux media-chrome's <media-controller> has its own shadow DOM with internal
    // z-index handling for native UI. Slotted overlays can end up underneath
    // the native control bar. Keep overlay at the player-stack root level so it
    // sits on its own stacking context above the engine.
    const ctx = makeContext({
      poster: "https://cdn.example.com/p.jpg",
      brandedThumb: { enabled: true },
    });
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    expect(overlay.parentElement).toBe(ctx.container);
    expect(overlay.parentElement?.tagName.toLowerCase()).toBe("player-stack");
  });

  it("overlay has explicit z-index so it sits above media-controller's native UI", async () => {
    const ctx = makeContext({
      poster: "https://cdn.example.com/p.jpg",
      brandedThumb: { enabled: true },
    });
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    const z = parseInt(overlay.style.zIndex, 10);
    expect(z).toBeGreaterThanOrEqual(2);
  });

  it("transparent mode: skips poster image, uses semi-transparent background, button stays visible", async () => {
    // Use case: autopreview shows muted preview underneath; user must see the
    // video AND the play button on top. Solid poster image would defeat that.
    const ctx = makeContext({
      poster: "https://cdn.example.com/p.jpg",
      brandedThumb: { enabled: true, transparent: true },
    });
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    expect(overlay.querySelector("img")).toBeNull();
    expect(overlay.style.background).toContain("rgba");
    expect(ctx.container.querySelector(".playerstack-thumb-play")).not.toBeNull();
  });

  it("non-transparent mode (default): renders poster image cover", async () => {
    const ctx = makeContext({
      poster: "https://cdn.example.com/p.jpg",
      brandedThumb: { enabled: true },
    });
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    expect(overlay.querySelector("img")).not.toBeNull();
  });

  it("does not render the poster <img> when poster is not an http(s) URL", async () => {
    const ctx = makeContext({
      poster: "javascript:x",
      brandedThumb: { enabled: true },
    });
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector("img")).toBeNull();
  });

  it("unmuteOnPlay: sets muted=false on the inner element on click", async () => {
    // Use case: autopreview muted-loops the video, click play should unmute.
    const ctx = makeContext({
      brandedThumb: { enabled: true, unmuteOnPlay: true },
    });
    (ctx.mediaPlayer as unknown as { muted: boolean }).muted = true;
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    overlay.click();
    expect((ctx.mediaPlayer as unknown as { muted: boolean }).muted).toBe(false);
  });

  it("does NOT touch muted state by default (cover-only mode)", async () => {
    const ctx = makeContext({ brandedThumb: { enabled: true } });
    (ctx.mediaPlayer as unknown as { muted: boolean }).muted = true;
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    overlay.click();
    expect((ctx.mediaPlayer as unknown as { muted: boolean }).muted).toBe(true);
  });

  it("restartOnPlay: sets currentTime=0 on click", async () => {
    // Use case: muted preview was looping, user clicked — restart from the beginning.
    const ctx = makeContext({
      brandedThumb: { enabled: true, restartOnPlay: true },
    });
    (ctx.mediaPlayer as unknown as { currentTime: number }).currentTime = 42;
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    overlay.click();
    expect((ctx.mediaPlayer as unknown as { currentTime: number }).currentTime).toBe(0);
  });

  it("does NOT touch currentTime by default", async () => {
    const ctx = makeContext({ brandedThumb: { enabled: true } });
    (ctx.mediaPlayer as unknown as { currentTime: number }).currentTime = 42;
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    overlay.click();
    expect((ctx.mediaPlayer as unknown as { currentTime: number }).currentTime).toBe(42);
  });

  it("with clickToLoad: removes src from mediaPlayer and stores it for later", async () => {
    const ctx = makeContext({
      brandedThumb: { enabled: true, clickToLoad: true },
    });
    await brandedThumbPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBeNull();
  });

  it("without clickToLoad: leaves mediaPlayer src untouched", async () => {
    const ctx = makeContext({
      brandedThumb: { enabled: true, clickToLoad: false },
    });
    await brandedThumbPlugin.init(ctx);
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("youtube/abc123");
  });

  it("clicking the overlay restores mediaPlayer src and removes overlay", async () => {
    const ctx = makeContext({
      brandedThumb: { enabled: true, clickToLoad: true },
    });
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    overlay.click();
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("youtube/abc123");
    expect(ctx.container.querySelector(".playerstack-thumb")).toBeNull();
  });

  it("emits a 'thumb:click' event on the bus when overlay is clicked", async () => {
    const ctx = makeContext({
      brandedThumb: { enabled: true },
    });
    const handler = vi.fn();
    ctx.events.on("thumb:click", handler);
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    overlay.click();
    expect(handler).toHaveBeenCalled();
  });

  it("calls play() on click even when clickToLoad is false (cover-only mode)", async () => {
    // Regression: user clicks the big play button overlay but the underlying
    // video never starts because the click handler short-circuited the play()
    // path when no held src was present.
    const ctx = makeContext({
      brandedThumb: { enabled: true, clickToLoad: false },
    });
    const playSpy = vi.fn(() => Promise.resolve());
    (ctx.mediaPlayer as unknown as { play: () => Promise<void> }).play = playSpy;
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    overlay.click();
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("calls play() on click in clickToLoad mode after restoring src", async () => {
    const ctx = makeContext({
      brandedThumb: { enabled: true, clickToLoad: true },
    });
    const playSpy = vi.fn(() => Promise.resolve());
    (ctx.mediaPlayer as unknown as { play: () => Promise<void> }).play = playSpy;
    await brandedThumbPlugin.init(ctx);
    const overlay = ctx.container.querySelector(".playerstack-thumb") as HTMLElement;
    overlay.click();
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("youtube/abc123");
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("destroy removes overlay and restores src if it was held", async () => {
    const ctx = makeContext({
      brandedThumb: { enabled: true, clickToLoad: true },
    });
    await brandedThumbPlugin.init(ctx);
    brandedThumbPlugin.destroy?.(ctx);
    expect(ctx.container.querySelector(".playerstack-thumb")).toBeNull();
    expect(ctx.mediaPlayer.getAttribute("src")).toBe("youtube/abc123");
  });
  it("uses playLabel as the play button's accessible name (default: Play video)", async () => {
    const ctx = makeContext({ brandedThumb: { enabled: true, playLabel: "Odtwórz film" } });
    await brandedThumbPlugin.init(ctx);
    const button = ctx.container.querySelector(".playerstack-thumb-play");
    expect(button?.getAttribute("aria-label")).toBe("Odtwórz film");
    const plain = makeContext({ brandedThumb: { enabled: true } });
    await brandedThumbPlugin.init(plain);
    expect(
      plain.container.querySelector(".playerstack-thumb-play")?.getAttribute("aria-label"),
    ).toBe("Play video");
  });
});
