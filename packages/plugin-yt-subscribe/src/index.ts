import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export interface YtSubscribeConfig {
  enabled?: boolean;
  /** YouTube channel UC… ID. */
  channelId?: string;
  /** YouTube @handle. */
  channelHandle?: string;
  /** Visible button text. Default: "Subscribe on YouTube". */
  label?: string;
}

interface State {
  bar: HTMLElement;
}

const states = new WeakMap<PlayerstackContext, State>();

export const ytSubscribePlugin: PlayerstackPlugin = {
  name: "yt-subscribe",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { ytSubscribe?: YtSubscribeConfig }).ytSubscribe;
    if (!cfg?.enabled) return;
    if (!cfg.channelId && !cfg.channelHandle) return;

    const url = cfg.channelId
      ? `https://www.youtube.com/channel/${encodeURIComponent(cfg.channelId)}?sub_confirmation=1`
      : `https://www.youtube.com/@${encodeURIComponent(cfg.channelHandle ?? "")}`;

    const bar = document.createElement("div");
    bar.className = "playerstack-yt-subscribe";
    bar.style.cssText =
      "display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 12px;background:rgba(0,0,0,0.04);border-radius:8px;margin-top:8px;font-family:inherit;font-size:14px;";

    const link = document.createElement("a");
    link.className = "playerstack-yt-subscribe-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = cfg.label ?? "Subscribe on YouTube";
    link.style.cssText =
      "background:#cc0000;color:#fff;padding:6px 14px;border-radius:4px;text-decoration:none;font-weight:600;";
    bar.appendChild(link);

    // Mount as a sibling AFTER <player-stack>: the container has
    // overflow:hidden + aspect-ratio:16/9 default styles, so anything appended
    // inside is clipped out of view.
    ctx.container.insertAdjacentElement("afterend", bar);
    states.set(ctx, { bar });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.bar.remove();
    states.delete(ctx);
  },
};
