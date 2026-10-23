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
    if (!preview?.enabled || ctx.config.preload === "none") return;
    if (prefersReducedMotion()) return;

    const player = ctx.mediaPlayer as HTMLElement & {
      play?: () => Promise<void> | void;
      pause?: () => void;
      muted?: boolean;
    };

    // Core applies preview attributes before connection, subject to preload and
    // reduced-motion preferences. This observer only controls viewport playback.

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
