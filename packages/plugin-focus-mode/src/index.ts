import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export interface FocusModeConfig {
  enabled?: boolean;
  /** Resume playing when the tab becomes visible again. Default false. */
  resumeOnVisible?: boolean;
}

interface State {
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, State>();

export const focusModePlugin: PlayerstackPlugin = {
  name: "focus-mode",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { focusMode?: FocusModeConfig }).focusMode;
    if (!cfg?.enabled) return;

    let wasPlayingBeforeHidden = false;

    const onVisibilityChange = () => {
      const player = ctx.mediaPlayer as HTMLElement & {
        pause?: () => void;
        play?: () => Promise<void> | void;
        paused?: boolean;
      };
      if (document.visibilityState === "hidden") {
        wasPlayingBeforeHidden = player.paused === false;
        player.pause?.();
        ctx.events.emit("focus-mode:hidden", undefined);
      } else {
        ctx.events.emit("focus-mode:visible", undefined);
        if (cfg.resumeOnVisible && wasPlayingBeforeHidden) {
          try {
            const result = player.play?.();
            if (result instanceof Promise) result.catch(() => {});
          } catch {
            /* play not yet available */
          }
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    states.set(ctx, {
      cleanup: () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};
