import {
  buildSafeCtaUrl,
  focusPlayerControl,
  sanitizeHtml,
  type PlayerstackPlugin,
  type PlayerstackContext,
} from "@playerstack/core";

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
  /** Hide from this second on. With either hide field the bar follows playback both ways. */
  hideAt?: number;
  /** Hide from this percent (0-100) of duration on. */
  hideAtPercent?: number;
  /** "badge" is a compact box in a corner instead of the full-width bar; default "bar". */
  variant?: "bar" | "badge";
  title?: string;
  html?: string;
  button?: ActionBarButton;
  /** Bar: "top" or "bottom" (default). Badge: also a corner; default "top-right". */
  position?: "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
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

    let bar: HTMLElement | undefined;
    let removeTimeListener: (() => void) | undefined;
    const stopListening = () => {
      removeTimeListener?.();
      removeTimeListener = undefined;
    };

    const setVisible = (visible: boolean) => {
      if (visible) {
        const first = !bar;
        bar ??= renderBar(cfg, ctx, stopListening);
        // Mount on <player-stack> directly — has position:relative + aspect-ratio
        // + overflow from core DEFAULT_STYLES. Mounting inside <media-controller>
        // would interleave with Mux's shadow DOM stacking.
        if (!bar.isConnected) ctx.container.appendChild(bar);
        if (first) ctx.events.emit("action-bar:show", undefined);
      } else if (bar?.isConnected) {
        const focused = bar.contains(bar.ownerDocument.activeElement);
        bar.remove();
        if (focused) focusPlayerControl(ctx.container);
      }
    };

    const { atPercent, hideAt, hideAtPercent } = cfg;
    const fromStart =
      cfg.showAt === "start" || (cfg.showAt === undefined && atPercent === undefined);
    const windowed = hideAt !== undefined || hideAtPercent !== undefined;

    if (!fromStart || windowed) {
      const seconds = typeof cfg.showAt === "number" ? cfg.showAt : undefined;
      const onTime = () => {
        const player = ctx.mediaPlayer as HTMLElement & {
          currentTime?: number;
          duration?: number;
        };
        const t = player.currentTime ?? 0;
        const d = player.duration ?? 0;
        const reached = (second?: number, percent?: number) =>
          (second !== undefined && t >= second) ||
          (percent !== undefined && d > 0 && (t / d) * 100 >= percent);
        const started = fromStart || reached(seconds, atPercent);
        if (windowed) setVisible(started && !reached(hideAt, hideAtPercent));
        else if (started) {
          stopListening();
          setVisible(true);
        }
      };
      ctx.mediaPlayer.addEventListener("timeupdate", onTime);
      removeTimeListener = () => ctx.mediaPlayer.removeEventListener("timeupdate", onTime);
    }
    if (fromStart) setVisible(true);

    states.set(ctx, {
      cleanup: () => {
        stopListening();
        bar?.remove();
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};

function renderBar(
  cfg: ActionBarConfig,
  ctx: PlayerstackContext,
  onDismiss: () => void,
): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "playerstack-action-bar";
  const badge = cfg.variant === "badge";
  if (badge) bar.classList.add("playerstack-action-bar-badge");
  const position = cfg.position ?? (badge ? "top-right" : "bottom");
  const positionEdge = position.startsWith("top") ? "top:8px;" : "bottom:60px;";
  const sides = !badge
    ? "left:8px;right:8px;"
    : `${position.endsWith("left") ? "left" : "right"}:8px;max-width:calc(100% - 16px);box-sizing:border-box;`;
  bar.style.cssText =
    `position:absolute;${sides}${positionEdge}` +
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
    html.innerHTML = sanitizeHtml(cfg.html);
    text.appendChild(html);
  }
  bar.appendChild(text);

  if (cfg.button) {
    const safeUrl = buildSafeCtaUrl(cfg.button.url, cfg.button.utm);
    if (safeUrl) {
      const link = document.createElement("a");
      link.className = "playerstack-action-bar-button";
      link.href = safeUrl;
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
  }

  const close = document.createElement("button");
  close.type = "button";
  close.className = "playerstack-action-bar-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Dismiss");
  close.style.cssText =
    "background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 4px;flex-shrink:0;";
  close.addEventListener("click", () => {
    onDismiss();
    bar.remove();
    ctx.events.emit("action-bar:dismiss", undefined);
  });
  bar.appendChild(close);

  return bar;
}
