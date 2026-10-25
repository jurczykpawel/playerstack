import {
  activateOverlay,
  focusPlayerControl,
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
  /** Replay button text (default: "Replay"). Set it in the page language. */
  replayLabel?: string;
}

interface CtaState {
  cleanup: () => void;
  release?: () => void;
}

const states = new WeakMap<PlayerstackContext, CtaState>();

export const ctaEndPlugin: PlayerstackPlugin = {
  name: "cta-end",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { ctaEnd?: CtaEndConfig }).ctaEnd;
    if (!cfg?.enabled) return;

    let interacted = false;
    const onInteraction = () => {
      interacted = true;
    };
    ctx.container.addEventListener("focusin", onInteraction);
    ctx.container.addEventListener("pointerdown", onInteraction);
    const onEnded = () => {
      removeOverlay(ctx);
      const overlay = renderOverlay(ctx, cfg);
      // Mount on <player-stack> (ctx.container) — has position:relative +
      // aspect-ratio + overflow from core DEFAULT_STYLES. Mounting inside
      // <media-controller> would tangle with Mux's shadow DOM stacking.
      ctx.container.appendChild(overlay);
      const state = states.get(ctx);
      if (state) state.release = activateOverlay(ctx.container, overlay, 3, interacted);
    };
    ctx.mediaPlayer.addEventListener("ended", onEnded);

    states.set(ctx, {
      cleanup: () => {
        ctx.mediaPlayer.removeEventListener("ended", onEnded);
        ctx.container.removeEventListener("focusin", onInteraction);
        ctx.container.removeEventListener("pointerdown", onInteraction);
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
    "justify-content:flex-start;gap:16px;background:rgba(0,0,0,0.7);color:#fff;" +
    "padding:24px;text-align:center;z-index:3;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;box-sizing:border-box;";

  if (cfg.title) {
    const h = document.createElement("h3");
    h.className = "playerstack-cta-title";
    h.textContent = cfg.title;
    // color:inherit so host-page heading styles (h3 { color }) do not override the overlay text color.
    h.style.cssText = "margin:0;font-size:24px;font-weight:600;color:inherit;";
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
    replay.textContent = cfg.replayLabel || "Replay";
    replay.style.cssText =
      "background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.4);padding:8px 16px;border-radius:6px;cursor:pointer;";
    replay.addEventListener("click", () => {
      ctx.events.emit("cta:replay", undefined);
      removeOverlay(ctx);
      const player = ctx.mediaPlayer as HTMLElement & { play?: () => Promise<void> | void };
      Object.assign(player, { currentTime: 0 });
      try {
        const result = player.play?.();
        if (result instanceof Promise) result.catch(() => {});
      } catch {}
      focusPlayerControl(ctx.container);
    });
    overlay.appendChild(replay);
  }

  for (const child of overlay.children) {
    const element = child as HTMLElement;
    element.style.flexShrink = "0";
    element.style.maxWidth = "100%";
    element.style.overflowWrap = "anywhere";
    element.style.boxSizing = "border-box";
  }
  if (overlay.firstElementChild)
    (overlay.firstElementChild as HTMLElement).style.marginTop = "auto";
  if (overlay.lastElementChild)
    (overlay.lastElementChild as HTMLElement).style.marginBottom = "auto";

  return overlay;
}

function removeOverlay(ctx: PlayerstackContext): void {
  const state = states.get(ctx);
  state?.release?.();
  if (state) state.release = undefined;
  const overlay = ctx.container.querySelector(".playerstack-cta");
  overlay?.remove();
}
