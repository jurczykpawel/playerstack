import { isSafeHttpUrl, type PlayerstackPlugin, type PlayerstackContext } from "@playerstack/core";

export interface AutopreviewConfig {
  enabled?: boolean;
  loopUntilInteraction?: boolean;
  threshold?: number;
  /**
   * Separate light clip played muted under the branded-thumb play button.
   * The full source loads only after the click and starts from 0:00 with sound.
   */
  src?: string;
  /** MIME type of `src`; the preview is skipped when the browser cannot play it. */
  type?: string;
}

const observers = new WeakMap<PlayerstackContext, IntersectionObserver>();
const stops = new WeakMap<PlayerstackContext, () => void>();
const clicks = new WeakMap<PlayerstackContext, () => void>();

function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function tryPlay(player: { play?: () => Promise<void> | void }): void {
  try {
    const result = player.play?.();
    if (result instanceof Promise) {
      result.catch(() => {
        /* policy still blocked — user will click play once */
      });
    }
  } catch {
    /* play() not yet available */
  }
}

function mountPreview(ctx: PlayerstackContext, preview: AutopreviewConfig): void {
  let src: string;
  try {
    src = new URL(preview.src!, document.baseURI).href;
  } catch {
    return;
  }
  if (!isSafeHttpUrl(src)) return;
  const video = document.createElement("video");
  if (preview.type && !video.canPlayType(preview.type)) return;

  video.className = "playerstack-preview";
  video.muted = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("aria-hidden", "true");
  video.tabIndex = -1;
  video.loop = preview.loopUntilInteraction !== false;
  const poster = ctx.config.poster;
  if (isSafeHttpUrl(poster)) video.setAttribute("poster", poster);
  video.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;";

  const thumb = (ctx.config as { brandedThumb?: { enabled?: boolean; clickToLoad?: boolean } })
    .brandedThumb;
  if (!thumb?.enabled || !thumb.clickToLoad) {
    console.warn(
      "[playerstack] preview.src needs brandedThumb { enabled: true, clickToLoad: true } to keep the full source unloaded until play",
    );
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // Mount on first view, once branded-thumb has rendered: inside its
          // overlay the preview sits above the poster and below the play button.
          // Off-screen players fetch nothing.
          if (!video.isConnected) {
            const button = ctx.container.querySelector(".playerstack-thumb-play");
            if (button) button.before(video);
            else ctx.container.appendChild(video);
            video.src = src;
          }
          tryPlay(video);
        } else {
          video.pause();
        }
      }
    },
    { threshold: preview.threshold ?? 0.5 },
  );
  observer.observe(ctx.container);
  observers.set(ctx, observer);

  const stop = () => {
    observer.disconnect();
    ctx.mediaPlayer.removeEventListener("play", onPlay);
    video.pause();
    // Removing src and reloading aborts the remaining preview download.
    video.removeAttribute("src");
    video.load();
    video.remove();
    stops.delete(ctx);
  };
  // play() without a source (e.g. email-gate "before" resuming playback while
  // the thumbnail still holds src) plays nothing, so the preview stays.
  const onPlay = () => {
    if (ctx.mediaPlayer.hasAttribute("src")) stop();
  };
  ctx.mediaPlayer.addEventListener("play", onPlay);
  stops.set(ctx, stop);
}

// The click always means "play with sound from 0:00", even when media-chrome
// restored a remembered mute (possibly again after src is set) and even when no
// preview was mounted (reduced motion, preload none). Re-assert only until
// playback starts so a later viewer mute is left alone.
function bindClick(ctx: PlayerstackContext): void {
  let ended: AbortController | undefined;
  const unsubscribe = ctx.events.on("thumb:click", () => {
    const player = ctx.mediaPlayer as HTMLElement & { muted: boolean; currentTime: number };
    const unmute = () => (player.muted = false);
    unmute();
    player.currentTime = 0;
    const { signal } = (ended = new AbortController());
    const end = () => ended!.abort();
    player.addEventListener("loadedmetadata", unmute, { signal });
    player.addEventListener("error", end, { signal });
    player.addEventListener(
      "playing",
      () => {
        unmute();
        end();
      },
      { signal },
    );
    stops.get(ctx)?.();
  });
  clicks.set(ctx, () => {
    unsubscribe();
    ended?.abort();
  });
}

export const autopreviewPlugin: PlayerstackPlugin = {
  name: "autopreview",
  async init(ctx: PlayerstackContext): Promise<void> {
    const preview = (ctx.config as { preview?: AutopreviewConfig }).preview;
    if (!preview?.enabled) return;
    if (preview.src) bindClick(ctx);
    if (ctx.config.preload === "none" || prefersReducedMotion()) return;
    if (preview.src) return mountPreview(ctx, preview);

    const player = ctx.mediaPlayer as HTMLElement & {
      play?: () => Promise<void> | void;
      pause?: () => void;
      muted?: boolean;
    };

    // Core applies preview attributes before connection, subject to preload and
    // reduced-motion preferences. This observer only controls viewport playback.

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if ("muted" in player) player.muted = true;
            tryPlay(player);
          } else {
            player.pause?.();
          }
        }
      },
      { threshold: preview.threshold ?? 0.5 },
    );
    observer.observe(ctx.mediaPlayer);
    observers.set(ctx, observer);
  },
  destroy(ctx: PlayerstackContext): void {
    stops.get(ctx)?.();
    clicks.get(ctx)?.();
    observers.get(ctx)?.disconnect();
    observers.delete(ctx);
  },
};
