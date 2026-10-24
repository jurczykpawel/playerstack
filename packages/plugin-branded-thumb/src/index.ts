import { isSafeHttpUrl, type PlayerstackPlugin, type PlayerstackContext } from "@playerstack/core";

export type PlayButtonStyle = "minimal" | "box" | "circle";

export interface BrandedThumbConfig {
  enabled?: boolean;
  playButtonStyle?: PlayButtonStyle;
  clickToLoad?: boolean;
  /**
   * Skip rendering the poster image, use a semi-transparent dim instead.
   * Use this when something is already visible underneath (e.g. autopreview's
   * muted loop) and you only want the play button on top.
   */
  transparent?: boolean;
  /** On click, set `muted=false` on the inner media element before play(). */
  unmuteOnPlay?: boolean;
  /** On click, set `currentTime=0` on the inner media element before play(). */
  restartOnPlay?: boolean;
  /** Accessible name of the play button (default: "Play video"). Set it in the page language. */
  playLabel?: string;
}

interface ThumbState {
  overlay: HTMLElement;
  heldSrc: string | null;
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, ThumbState>();

export const brandedThumbPlugin: PlayerstackPlugin = {
  name: "branded-thumb",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { brandedThumb?: BrandedThumbConfig; poster?: string }).brandedThumb;
    if (!cfg?.enabled) return;

    const poster = (ctx.config as { poster?: string }).poster;
    const buttonStyle: PlayButtonStyle = cfg.playButtonStyle ?? "circle";
    const transparent = cfg.transparent === true;

    const overlay = document.createElement("div");
    overlay.className = "playerstack-thumb";
    // z-index 2 keeps overlay above <media-control-bar> and any UI Mux
    // media-chrome paints inside <media-controller>.
    const background = transparent ? "rgba(0,0,0,0.25)" : "#000";
    overlay.style.cssText =
      "position:absolute;inset:0;cursor:pointer;display:flex;align-items:center;" +
      `justify-content:center;z-index:2;background:${background};`;

    // Solid poster image only in cover mode. Transparent mode keeps whatever is
    // underneath visible (autopreview muted loop, custom CSS bg, etc).
    if (isSafeHttpUrl(poster) && !transparent) {
      const img = document.createElement("img");
      img.src = poster;
      img.alt = "";
      img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;";
      img.loading = "lazy";
      overlay.appendChild(img);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "playerstack-thumb-play";
    button.setAttribute("data-style", buttonStyle);
    button.setAttribute("aria-label", cfg.playLabel || "Play video");
    applyPlayButtonStyle(button, buttonStyle);
    button.appendChild(buildPlayTriangle());
    overlay.appendChild(button);

    let heldSrc: string | null = null;
    if (cfg.clickToLoad) {
      const existing = ctx.mediaPlayer.getAttribute("src");
      if (existing) {
        heldSrc = existing;
        ctx.mediaPlayer.removeAttribute("src");
      } else {
        heldSrc = ctx.config.src;
      }
    }

    const controller = ctx.mediaPlayer.closest<HTMLElement>("media-controller");
    controller?.setAttribute("inert", "");

    const onClick = () => {
      const state = states.get(ctx);
      // In clickToLoad mode the src was deferred — restore it now so the
      // element starts loading. In cover-only mode (clickToLoad: false) src is
      // already present.
      if (state?.heldSrc) {
        ctx.mediaPlayer.setAttribute("src", state.heldSrc);
      }
      const player = ctx.mediaPlayer as HTMLElement & {
        play?: () => Promise<void> | void;
        muted?: boolean;
        currentTime?: number;
      };
      // Pre-play state changes — must happen synchronously inside the click
      // handler to keep the user-gesture for autoplay policy.
      if (cfg.unmuteOnPlay && "muted" in player) player.muted = false;
      if (cfg.restartOnPlay && "currentTime" in player) player.currentTime = 0;
      const tryPlay = () => {
        try {
          const result = player.play?.();
          if (result instanceof Promise) {
            result.catch(() => {
              /* autoplay blocked — user can still hit the native play button */
            });
          }
        } catch {
          /* play() not yet on prototype; canplay listener will retry */
        }
      };
      // Synchronous attempt preserves the user-gesture for autoplay policy.
      // ALWAYS try, regardless of clickToLoad — the click is the start signal.
      tryPlay();
      // Element may still be hydrating (especially <youtube-video>); retry once
      // it can actually play.
      ctx.mediaPlayer.addEventListener("canplay", tryPlay, { once: true });
      ctx.events.emit("thumb:click", undefined);
      state?.cleanup();
      (controller?.querySelector<HTMLElement>("media-play-button") ?? controller)?.focus();
    };
    overlay.addEventListener("click", onClick);

    // Mount on <player-stack> directly (not inside <media-controller>): Mux's
    // controller has its own shadow DOM with internal z-index handling for
    // native UI; slotted overlays can end up underneath the native control bar.
    // <player-stack> already has position:relative from core's DEFAULT_STYLES.
    ctx.container.appendChild(overlay);

    const cleanup = () => {
      overlay.removeEventListener("click", onClick);
      overlay.remove();
      controller?.removeAttribute("inert");
      states.delete(ctx);
    };
    states.set(ctx, { overlay, heldSrc, cleanup });
  },
  destroy(ctx: PlayerstackContext): void {
    const state = states.get(ctx);
    if (!state) return;
    if (state.heldSrc !== null && !ctx.mediaPlayer.hasAttribute("src")) {
      ctx.mediaPlayer.setAttribute("src", state.heldSrc);
    }
    state.cleanup();
  },
};

const PLAY_BUTTON_BASE =
  "position:relative;z-index:1;width:84px;height:84px;padding:0;display:inline-flex;" +
  "align-items:center;justify-content:center;cursor:pointer;color:#fff;" +
  "transition:transform 160ms ease, background-color 160ms ease, border-color 160ms ease;";

function applyPlayButtonStyle(button: HTMLButtonElement, style: PlayButtonStyle): void {
  let extras = "";
  switch (style) {
    case "circle":
      extras =
        "border:none;border-radius:50%;background:var(--ps-accent,rgba(0,0,0,0.55));" +
        "box-shadow:0 6px 20px rgba(0,0,0,0.35);";
      break;
    case "box":
      extras =
        "border:none;border-radius:14px;background:var(--ps-accent,rgba(0,0,0,0.55));" +
        "box-shadow:0 6px 20px rgba(0,0,0,0.35);";
      break;
    case "minimal":
      extras = "border:2px solid rgba(255,255,255,0.85);border-radius:50%;background:transparent;";
      break;
  }
  button.style.cssText = PLAY_BUTTON_BASE + extras;
}

function buildPlayTriangle(): SVGElement {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "36");
  svg.setAttribute("height", "36");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "display:block;margin-left:3px;"; // optical centering for triangle
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M8 5v14l11-7z");
  svg.appendChild(path);
  return svg;
}
