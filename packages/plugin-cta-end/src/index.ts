import {
  buildSafeCtaUrl,
  sanitizeHtml,
  type PlayerstackPlugin,
  type PlayerstackContext,
} from "@playerstack/core";

export interface CtaButton {
  label: string;
  url: string;
  utm?: string;
}

export interface CtaEndConfig {
  enabled?: boolean;
  title?: string;
  html?: string;
  button?: CtaButton;
  showReplay?: boolean;
}

interface CtaState {
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, CtaState>();

export const ctaEndPlugin: PlayerstackPlugin = {
  name: "cta-end",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { ctaEnd?: CtaEndConfig }).ctaEnd;
    if (!cfg?.enabled) return;

    const onEnded = () => {
      removeOverlay(ctx);
      const overlay = renderOverlay(ctx, cfg);
      // Mount on <player-stack> (ctx.container) — has position:relative +
      // aspect-ratio + overflow from core DEFAULT_STYLES. Mounting inside
      // <media-controller> would tangle with Mux's shadow DOM stacking.
      ctx.container.appendChild(overlay);
    };
    ctx.mediaPlayer.addEventListener("ended", onEnded);

    states.set(ctx, {
      cleanup: () => {
        ctx.mediaPlayer.removeEventListener("ended", onEnded);
        removeOverlay(ctx);
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};

function renderOverlay(ctx: PlayerstackContext, cfg: CtaEndConfig): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "playerstack-cta";
  overlay.style.cssText =
    "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;" +
    "justify-content:center;gap:16px;background:rgba(0,0,0,0.7);color:#fff;" +
    "padding:24px;text-align:center;z-index:3;";

  if (cfg.title) {
    const h = document.createElement("h3");
    h.className = "playerstack-cta-title";
    h.textContent = cfg.title;
    h.style.cssText = "margin:0;font-size:24px;font-weight:600;";
    overlay.appendChild(h);
  }

  if (cfg.html) {
    const wrap = document.createElement("div");
    wrap.className = "playerstack-cta-html";
    wrap.innerHTML = sanitizeHtml(cfg.html);
    overlay.appendChild(wrap);
  }

  if (cfg.button) {
    const safeUrl = buildSafeCtaUrl(cfg.button.url, cfg.button.utm);
    if (safeUrl) {
      const link = document.createElement("a");
      link.className = "playerstack-cta-button";
      link.href = safeUrl;
      link.textContent = cfg.button.label;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.cssText =
        "background:var(--ps-accent,#008aff);color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;";
      link.addEventListener("click", () => {
        ctx.events.emit("cta:click", { label: cfg.button!.label, url: link.href });
      });
      overlay.appendChild(link);
    }
  }

  if (cfg.showReplay) {
    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "playerstack-cta-replay";
    replay.textContent = "Replay";
    replay.style.cssText =
      "background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.4);padding:8px 16px;border-radius:6px;cursor:pointer;";
    replay.addEventListener("click", () => {
      ctx.events.emit("cta:replay", undefined);
      removeOverlay(ctx);
      const player = ctx.mediaPlayer as HTMLElement & { play?: () => Promise<void> | void };
      player.play?.();
    });
    overlay.appendChild(replay);
  }

  return overlay;
}

function removeOverlay(ctx: PlayerstackContext): void {
  const overlay = ctx.container.querySelector(".playerstack-cta");
  overlay?.remove();
}
