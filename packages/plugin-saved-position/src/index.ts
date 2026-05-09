import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export interface SavedPositionConfig {
  enabled?: boolean;
  /** Storage key prefix; full key = `${prefix}:${src}`. */
  keyPrefix?: string;
  /** Debounce window for save calls in ms. */
  throttleMs?: number;
  /** Don't restore if saved time is within `endTolerance` of duration end. */
  endTolerance?: number;
}

interface State {
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, State>();

export const savedPositionPlugin: PlayerstackPlugin = {
  name: "saved-position",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { savedPosition?: SavedPositionConfig }).savedPosition;
    if (!cfg?.enabled) return;
    if (typeof localStorage === "undefined") return;

    const prefix = cfg.keyPrefix ?? "playerstack:pos";
    const key = `${prefix}:${ctx.config.src}`;
    const throttleMs = cfg.throttleMs ?? 1000;
    const endTolerance = cfg.endTolerance ?? 5;

    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    const onTime = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const player = ctx.mediaPlayer as HTMLElement & { currentTime?: number };
        const t = player.currentTime;
        if (typeof t === "number" && t > 0) {
          localStorage.setItem(key, String(Math.floor(t)));
        }
      }, throttleMs);
    };

    const onLoadedMetadata = () => {
      const stored = localStorage.getItem(key);
      if (!stored) return;
      const t = Number(stored);
      if (!Number.isFinite(t)) return;
      const player = ctx.mediaPlayer as HTMLElement & {
        currentTime?: number;
        duration?: number;
      };
      const duration = player.duration ?? 0;
      if (duration > 0 && duration - t <= endTolerance) {
        localStorage.removeItem(key);
        return;
      }
      if ("currentTime" in player) player.currentTime = t;
    };

    const onEnded = () => {
      localStorage.removeItem(key);
    };

    ctx.mediaPlayer.addEventListener("timeupdate", onTime);
    ctx.mediaPlayer.addEventListener("loaded-metadata", onLoadedMetadata);
    ctx.mediaPlayer.addEventListener("ended", onEnded);

    states.set(ctx, {
      cleanup: () => {
        if (saveTimer) clearTimeout(saveTimer);
        ctx.mediaPlayer.removeEventListener("timeupdate", onTime);
        ctx.mediaPlayer.removeEventListener("loaded-metadata", onLoadedMetadata);
        ctx.mediaPlayer.removeEventListener("ended", onEnded);
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};
