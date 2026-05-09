import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export interface AutopreviewConfig {
  enabled?: boolean;
  loopUntilInteraction?: boolean;
  threshold?: number;
}

const observers = new WeakMap<PlayerstackContext, IntersectionObserver>();

function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const autopreviewPlugin: PlayerstackPlugin = {
  name: "autopreview",
  async init(ctx: PlayerstackContext): Promise<void> {
    const preview = (ctx.config as { preview?: AutopreviewConfig }).preview;
    if (!preview?.enabled) return;
    if (prefersReducedMotion()) return;

    const player = ctx.mediaPlayer as HTMLElement & {
      play?: () => Promise<void> | void;
      pause?: () => void;
      muted?: boolean;
    };

    // Initial attributes (muted/autoplay/loop/load=eager) are set BEFORE
    // connectedCallback by core/playerstack-element.buildMediaPlayer when
    // config.preview.enabled is true. That's how Plyr-based players (e.g.
    // Presto) get muted autoplay to work — browser policy honors initial
    // HTML attributes; programmatic setAttribute after connect doesn't
    // re-trigger the autoplay attempt.
    //
    // This plugin only wires up the IntersectionObserver to pause/resume
    // based on viewport, plus re-mute on resume so a scrolled-back player
    // never blasts audio.

    const tryPlay = () => {
      try {
        if ("muted" in player) player.muted = true;
        const result = player.play?.();
        if (result instanceof Promise) {
          result.catch(() => {
            /* policy still blocked — user will click play once */
          });
        }
      } catch {
        /* play() not yet available */
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            tryPlay();
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
    observers.get(ctx)?.disconnect();
    observers.delete(ctx);
  },
};
