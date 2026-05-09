import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

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
      const wrapper = ensurePositionedParent(ctx.mediaPlayer);
      wrapper.appendChild(overlay);
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
    "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(0,0,0,0.7);color:#fff;padding:24px;text-align:center;";

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
    wrap.innerHTML = cfg.html;
    overlay.appendChild(wrap);
  }

  if (cfg.button) {
    const link = document.createElement("a");
    link.className = "playerstack-cta-button";
    link.href = appendUtm(cfg.button.url, cfg.button.utm);
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
