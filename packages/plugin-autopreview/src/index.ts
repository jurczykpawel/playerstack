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

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            player.muted = true;
            player.play?.();
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
