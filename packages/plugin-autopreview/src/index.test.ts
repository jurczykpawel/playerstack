import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { autopreviewPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

interface MockObserverInstance {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  trigger: (isIntersecting: boolean) => void;
}

let observers: MockObserverInstance[] = [];
let prefersReducedMotion = false;

beforeEach(() => {
  observers = [];
  prefersReducedMotion = false;

  class MockIO {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    private cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
      const instance: MockObserverInstance = {
        observe: this.observe,
        unobserve: this.unobserve,
        disconnect: this.disconnect,
        trigger: (isIntersecting: boolean) => {
          this.cb(
            [{ isIntersecting } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        },
      };
      observers.push(instance);
    }
  }
  globalThis.IntersectionObserver = MockIO as unknown as typeof IntersectionObserver;

  globalThis.matchMedia = ((query: string) => ({
    matches: query.includes("reduce") ? prefersReducedMotion : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof matchMedia;
});

afterEach(() => {
  // @ts-expect-error cleanup
  delete globalThis.IntersectionObserver;
});

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext & {
  playSpy: ReturnType<typeof vi.fn>;
  pauseSpy: ReturnType<typeof vi.fn>;
} {
  const container = document.createElement("div");
  const mediaPlayer = document.createElement("media-player") as unknown as HTMLElement & {
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    muted: boolean;
  };
  mediaPlayer.play = vi.fn(() => Promise.resolve());
  mediaPlayer.pause = vi.fn();
  mediaPlayer.muted = false;
  container.appendChild(mediaPlayer);
  return Object.assign(
    {
      events: createEventBus(),
      container,
      mediaPlayer,
      config: { src: "https://example.com/v.mp4", ...extra },
    } as PlayerstackContext,
    { playSpy: mediaPlayer.play, pauseSpy: mediaPlayer.pause },
  );
}

describe("autopreviewPlugin", () => {
  it("has a stable name", () => {
    expect(autopreviewPlugin.name).toBe("autopreview");
  });

  it("does nothing when preview.enabled is not true", async () => {
    const ctx = makeContext();
    await autopreviewPlugin.init(ctx);
    expect(observers.length).toBe(0);
  });

  it("creates an IntersectionObserver when preview.enabled is true", async () => {
    const ctx = makeContext({ preview: { enabled: true } });
    await autopreviewPlugin.init(ctx);
    expect(observers.length).toBe(1);
    expect(observers[0]?.observe).toHaveBeenCalledWith(ctx.mediaPlayer);
  });

  it("calls play() and mutes mediaPlayer when it enters the viewport", async () => {
    const ctx = makeContext({ preview: { enabled: true } });
    await autopreviewPlugin.init(ctx);
    observers[0]?.trigger(true);
    expect(ctx.playSpy).toHaveBeenCalled();
    expect((ctx.mediaPlayer as HTMLElement & { muted: boolean }).muted).toBe(true);
  });

  it("calls pause() when mediaPlayer leaves the viewport", async () => {
    const ctx = makeContext({ preview: { enabled: true } });
    await autopreviewPlugin.init(ctx);
    observers[0]?.trigger(true);
    observers[0]?.trigger(false);
    expect(ctx.pauseSpy).toHaveBeenCalled();
  });

  it("respects prefers-reduced-motion and never plays automatically", async () => {
    prefersReducedMotion = true;
    const ctx = makeContext({ preview: { enabled: true } });
    await autopreviewPlugin.init(ctx);
    observers[0]?.trigger(true);
    expect(ctx.playSpy).not.toHaveBeenCalled();
  });

  it("does not let viewport preview override preload none", async () => {
    const ctx = makeContext({ preload: "none", preview: { enabled: true } });
    await autopreviewPlugin.init(ctx);
    observers[0]?.trigger(true);
    expect(ctx.playSpy).not.toHaveBeenCalled();
    expect(observers).toHaveLength(0);
  });

  it("destroy disconnects the observer", async () => {
    const ctx = makeContext({ preview: { enabled: true } });
    await autopreviewPlugin.init(ctx);
    autopreviewPlugin.destroy?.(ctx);
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });

  describe("with preview.src", () => {
    const src = "https://example.com/preview.mp4";
    const thumbConfig = { brandedThumb: { enabled: true, clickToLoad: true } };
    const previewOf = (ctx: PlayerstackContext) =>
      ctx.container.querySelector<HTMLVideoElement>("video.playerstack-preview");
    const withThumb = (ctx: PlayerstackContext) => {
      const overlay = document.createElement("div");
      overlay.className = "playerstack-thumb";
      overlay.innerHTML = '<img alt=""><button class="playerstack-thumb-play"></button>';
      ctx.container.appendChild(overlay);
      return overlay;
    };
    let play: ReturnType<typeof vi.spyOn>;
    let pause: ReturnType<typeof vi.spyOn>;
    let load: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      play = vi.spyOn(HTMLVideoElement.prototype, "play").mockResolvedValue();
      pause = vi.spyOn(HTMLVideoElement.prototype, "pause").mockImplementation(() => {});
      load = vi.spyOn(HTMLVideoElement.prototype, "load").mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it("mounts nothing and fetches nothing until the player is in view", async () => {
      const ctx = makeContext({ ...thumbConfig, preview: { enabled: true, src } });
      await autopreviewPlugin.init(ctx);
      expect(previewOf(ctx)).toBeNull();
      expect(observers[0]?.observe).toHaveBeenCalledWith(ctx.container);
    });

    it("mounts a muted, looping, hidden preview between poster and play button", async () => {
      const ctx = makeContext({
        ...thumbConfig,
        poster: "https://example.com/p.jpg",
        preview: { enabled: true, src },
      });
      await autopreviewPlugin.init(ctx);
      const overlay = withThumb(ctx);
      observers[0]?.trigger(true);
      const video = previewOf(ctx)!;
      expect([...overlay.children].map((el) => el.tagName)).toEqual(["IMG", "VIDEO", "BUTTON"]);
      expect(video.muted).toBe(true);
      expect(video.hasAttribute("muted")).toBe(true);
      expect(video.hasAttribute("playsinline")).toBe(true);
      expect(video.loop).toBe(true);
      expect(video.controls).toBe(false);
      expect(video.getAttribute("aria-hidden")).toBe("true");
      expect(video.tabIndex).toBe(-1);
      expect(video.getAttribute("poster")).toBe("https://example.com/p.jpg");
      expect(video.getAttribute("src")).toBe(src);
      expect(ctx.playSpy).not.toHaveBeenCalled();
    });

    it("plays the preview in view and pauses it out of view", async () => {
      const ctx = makeContext({ preview: { enabled: true, src } });
      await autopreviewPlugin.init(ctx);
      observers[0]?.trigger(true);
      // Without a thumbnail the preview falls back to the container.
      expect(ctx.container.lastElementChild).toBe(previewOf(ctx));
      expect(play).toHaveBeenCalledTimes(1);
      observers[0]?.trigger(false);
      expect(pause).toHaveBeenCalledTimes(1);
      observers[0]?.trigger(true);
      expect(play).toHaveBeenCalledTimes(2);
      expect(ctx.container.querySelectorAll("video.playerstack-preview")).toHaveLength(1);
      expect(ctx.playSpy).not.toHaveBeenCalled();
      expect(ctx.pauseSpy).not.toHaveBeenCalled();
    });

    it("does not loop when loopUntilInteraction is false", async () => {
      const ctx = makeContext({ preview: { enabled: true, src, loopUntilInteraction: false } });
      await autopreviewPlugin.init(ctx);
      observers[0]?.trigger(true);
      expect(previewOf(ctx)!.loop).toBe(false);
    });

    it.each(["thumb:click", "main play"])(
      "stops downloading and removes the preview on %s",
      async (trigger) => {
        const ctx = makeContext({ preview: { enabled: true, src } });
        await autopreviewPlugin.init(ctx);
        observers[0]?.trigger(true);
        const video = previewOf(ctx)!;
        if (trigger === "thumb:click") ctx.events.emit("thumb:click", undefined);
        else {
          ctx.mediaPlayer.setAttribute("src", "https://example.com/v.mp4");
          ctx.mediaPlayer.dispatchEvent(new Event("play"));
        }
        expect(video.hasAttribute("src")).toBe(false);
        expect(load).toHaveBeenCalled();
        expect(previewOf(ctx)).toBeNull();
        expect(observers[0]?.disconnect).toHaveBeenCalled();
      },
    );

    describe("click starts from 0:00 with sound", () => {
      const clicked = async () => {
        const ctx = makeContext({ preview: { enabled: true, src } });
        const player = ctx.mediaPlayer as HTMLElement & { muted: boolean; currentTime: number };
        // Remembered mute restored by media-chrome, and a stale position.
        player.muted = true;
        player.currentTime = 7;
        await autopreviewPlugin.init(ctx);
        observers[0]?.trigger(true);
        ctx.events.emit("thumb:click", undefined);
        return player;
      };

      it("unmutes and rewinds the main media inside the click", async () => {
        const player = await clicked();
        expect(player.muted).toBe(false);
        expect(player.currentTime).toBe(0);
      });

      it("undoes a mute restored after src is set, until playback starts", async () => {
        const player = await clicked();
        player.muted = true;
        player.dispatchEvent(new Event("loadedmetadata"));
        expect(player.muted).toBe(false);
        player.muted = true;
        player.dispatchEvent(new Event("playing"));
        expect(player.muted).toBe(false);
      });

      it("leaves a mute the viewer chooses after playback started", async () => {
        const player = await clicked();
        player.dispatchEvent(new Event("playing"));
        player.muted = true;
        player.dispatchEvent(new Event("playing"));
        player.dispatchEvent(new Event("loadedmetadata"));
        expect(player.muted).toBe(true);
      });

      it.each(["error", "destroy"])(
        "stops re-asserting the unmute after %s of a failed start",
        async (ending) => {
          const ctx = makeContext({ preview: { enabled: true, src } });
          const player = ctx.mediaPlayer as HTMLElement & { muted: boolean };
          await autopreviewPlugin.init(ctx);
          observers[0]?.trigger(true);
          ctx.events.emit("thumb:click", undefined);
          if (ending === "error") player.dispatchEvent(new Event("error"));
          else autopreviewPlugin.destroy?.(ctx);
          player.muted = true;
          player.dispatchEvent(new Event("loadedmetadata"));
          player.dispatchEvent(new Event("playing"));
          expect(player.muted).toBe(true);
        },
      );
    });

    it.each(["reduced motion", "preload none"])(
      "click still unmutes and rewinds with %s (no preview mounted)",
      async (mode) => {
        const ctx = makeContext({
          ...(mode === "preload none" ? { preload: "none" as const } : {}),
          preview: { enabled: true, src },
        });
        prefersReducedMotion = mode === "reduced motion";
        const player = ctx.mediaPlayer as HTMLElement & { muted: boolean; currentTime: number };
        player.muted = true;
        player.currentTime = 7;
        await autopreviewPlugin.init(ctx);
        expect(observers).toHaveLength(0);
        ctx.events.emit("thumb:click", undefined);
        expect(player.muted).toBe(false);
        expect(player.currentTime).toBe(0);
        player.muted = true;
        player.dispatchEvent(new Event("loadedmetadata"));
        expect(player.muted).toBe(false);
        player.dispatchEvent(new Event("playing"));
        player.muted = true;
        player.dispatchEvent(new Event("loadedmetadata"));
        expect(player.muted).toBe(true);
        autopreviewPlugin.destroy?.(ctx);
        prefersReducedMotion = false;
      },
    );

    it("keeps the preview when play() is called before the full source is loaded", async () => {
      // e.g. email-gate "before" resumes playback while the thumbnail still holds src.
      const ctx = makeContext({ preview: { enabled: true, src } });
      await autopreviewPlugin.init(ctx);
      observers[0]?.trigger(true);
      ctx.mediaPlayer.dispatchEvent(new Event("play"));
      expect(previewOf(ctx)).not.toBeNull();
    });

    it("warns when no click-to-load thumbnail keeps the full source unloaded", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      await autopreviewPlugin.init(makeContext({ preview: { enabled: true, src } }));
      await autopreviewPlugin.init(
        makeContext({ ...thumbConfig, preview: { enabled: true, src } }),
      );
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it("renders nothing under reduced motion or preload none", async () => {
      prefersReducedMotion = true;
      await autopreviewPlugin.init(makeContext({ preview: { enabled: true, src } }));
      prefersReducedMotion = false;
      await autopreviewPlugin.init(
        makeContext({ preload: "none", preview: { enabled: true, src } }),
      );
      expect(observers).toHaveLength(0);
    });

    it("skips unsafe sources and unsupported types", async () => {
      await autopreviewPlugin.init(
        makeContext({ preview: { enabled: true, src: "javascript:alert(1)" } }),
      );
      vi.spyOn(HTMLVideoElement.prototype, "canPlayType").mockReturnValue("");
      await autopreviewPlugin.init(
        makeContext({ preview: { enabled: true, src, type: "video/webm" } }),
      );
      expect(observers).toHaveLength(0);
    });

    it("destroy removes the preview", async () => {
      const ctx = makeContext({ preview: { enabled: true, src } });
      await autopreviewPlugin.init(ctx);
      observers[0]?.trigger(true);
      autopreviewPlugin.destroy?.(ctx);
      expect(previewOf(ctx)).toBeNull();
      expect(observers[0]?.disconnect).toHaveBeenCalled();
    });
  });
});
