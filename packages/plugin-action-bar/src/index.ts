import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export interface ActionBarButton {
  label: string;
  url: string;
  utm?: string;
}

export interface ActionBarConfig {
  enabled?: boolean;
  /** "start" shows on init. A number is ALWAYS seconds. For percent use `atPercent`. */
  showAt?: "start" | number;
  /** Optional percent threshold (0-100) of duration. Mutually compatible with `showAt`. */
  atPercent?: number;
  title?: string;
  html?: string;
  button?: ActionBarButton;
  /** "top" or "bottom"; default "bottom". */
  position?: "top" | "bottom";
}

interface State {
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, State>();

export const actionBarPlugin: PlayerstackPlugin = {
  name: "action-bar",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { actionBar?: ActionBarConfig }).actionBar;
    if (!cfg?.enabled) return;

    let shown = false;
    let removeTimeListener: (() => void) | null = null;

    const show = () => {
      if (shown) return;
      shown = true;
      removeTimeListener?.();
      removeTimeListener = null;
      const bar = renderBar(cfg, ctx);
      const wrapper = ensurePositionedParent(ctx.mediaPlayer);
      wrapper.appendChild(bar);
    };

    const atPercent = cfg.atPercent;
    if (cfg.showAt === undefined && atPercent === undefined) {
      show();
    } else if (cfg.showAt === "start") {
      show();
    } else {
      const seconds = typeof cfg.showAt === "number" ? cfg.showAt : undefined;
      const onTime = () => {
        const player = ctx.mediaPlayer as HTMLElement & {
          currentTime?: number;
          duration?: number;
        };
        const t = player.currentTime ?? 0;
        const d = player.duration ?? 0;
        const triggerSeconds = seconds !== undefined && t >= seconds;
        const triggerPercent = atPercent !== undefined && d > 0 && (t / d) * 100 >= atPercent;
        if (triggerSeconds || triggerPercent) show();
      };
      ctx.mediaPlayer.addEventListener("timeupdate", onTime);
      removeTimeListener = () => ctx.mediaPlayer.removeEventListener("timeupdate", onTime);
    }

    states.set(ctx, {
      cleanup: () => {
        removeTimeListener?.();
        ctx.container.querySelector(".playerstack-action-bar")?.remove();
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};

function renderBar(cfg: ActionBarConfig, ctx: PlayerstackContext): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "playerstack-action-bar";
  const positionEdge = cfg.position === "top" ? "top:8px;" : "bottom:60px;";
  bar.style.cssText =
    `position:absolute;left:8px;right:8px;${positionEdge}` +
    "background:rgba(0,0,0,0.85);color:#fff;padding:10px 14px;border-radius:8px;display:flex;align-items:center;gap:12px;z-index:2;backdrop-filter:blur(4px);";

  const text = document.createElement("div");
  text.style.cssText = "flex:1;font-size:14px;line-height:1.3;";
  if (cfg.title) {
    const heading = document.createElement("strong");
    heading.style.cssText = "display:block;";
    heading.textContent = cfg.title;
    text.appendChild(heading);
  }
  if (cfg.html) {
    const html = document.createElement("span");
    html.innerHTML = cfg.html;
    text.appendChild(html);
  }
  bar.appendChild(text);

  if (cfg.button) {
    const link = document.createElement("a");
    link.className = "playerstack-action-bar-button";
    link.href = appendUtm(cfg.button.url, cfg.button.utm);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = cfg.button.label;
    link.style.cssText =
      "padding:6px 12px;background:var(--ps-accent,#008aff);color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;flex-shrink:0;";
    link.addEventListener("click", () => {
      ctx.events.emit("action-bar:click", { label: cfg.button!.label, url: link.href });
    });
    bar.appendChild(link);
  }

  const close = document.createElement("button");
  close.type = "button";
  close.className = "playerstack-action-bar-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Dismiss");
  close.style.cssText =
    "background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 4px;flex-shrink:0;";
  close.addEventListener("click", () => {
    bar.remove();
    ctx.events.emit("action-bar:dismiss", undefined);
  });
  bar.appendChild(close);

  return bar;
}

function appendUtm(url: string, utm?: string): string {
  if (!utm) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${utm}`;
}

function ensurePositionedParent(mediaPlayer: HTMLElement): HTMLElement {
  const parent = mediaPlayer.parentElement;
  if (parent) {
    if (!parent.style.position) parent.style.position = "relative";
    return parent;
  }
  return mediaPlayer;
}
