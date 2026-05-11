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

    // Disable browser/OS auto-PiP — Chrome and macOS trigger Picture-in-Picture
    // automatically when switching tabs; that overrides our pause intent.
    const videoEl = ctx.mediaPlayer as HTMLVideoElement & {
      disablePictureInPicture?: boolean;
    };
    videoEl.disablePictureInPicture = true;

    let wasPlayingBeforeHidden = false;

    const exitPip = () => {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    };

    const onVisibilityChange = () => {
      const player = ctx.mediaPlayer as HTMLElement & {
        pause?: () => void;
        play?: () => Promise<void> | void;
        paused?: boolean;
      };
      if (document.visibilityState === "hidden") {
        wasPlayingBeforeHidden = player.paused === false;
        if (wasPlayingBeforeHidden) {
          exitPip();
          player.pause?.();
        }
        ctx.events.emit("focus-mode:hidden", undefined);
      } else {
        exitPip();
        ctx.events.emit("focus-mode:visible", undefined);
        if (wasPlayingBeforeHidden) {
          if (cfg.resumeOnVisible) {
            try {
              const result = player.play?.();
              if (result instanceof Promise) result.catch(() => {});
            } catch {
              /* play not yet available */
            }
          } else {
            // Re-enforce pause in case media-controller or the browser auto-resumed.
            player.pause?.();
          }
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    states.set(ctx, {
      cleanup: () => {
        videoEl.disablePictureInPicture = false;
        document.removeEventListener("visibilitychange", onVisibilityChange);
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};
