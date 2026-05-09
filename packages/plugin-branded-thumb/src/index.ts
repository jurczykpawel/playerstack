import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export type PlayButtonStyle = "minimal" | "box" | "circle";

export interface BrandedThumbConfig {
  enabled?: boolean;
  playButtonStyle?: PlayButtonStyle;
  clickToLoad?: boolean;
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

    const overlay = document.createElement("div");
    overlay.className = "playerstack-thumb";
    overlay.setAttribute("role", "button");
    overlay.setAttribute("tabindex", "0");
    overlay.style.cssText =
      "position:absolute;inset:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#000;";

    if (poster) {
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
    button.setAttribute("aria-label", "Play video");
    button.textContent = "▶";
    button.style.cssText =
      "position:relative;z-index:1;font-size:32px;line-height:1;border:none;cursor:pointer;";
    overlay.appendChild(button);

    let heldSrc: string | null = null;
    if (cfg.clickToLoad) {
      heldSrc = ctx.mediaPlayer.getAttribute("src");
      if (heldSrc !== null) ctx.mediaPlayer.removeAttribute("src");
    }

    const onClick = () => {
      const state = states.get(ctx);
      if (state?.heldSrc) {
        ctx.mediaPlayer.setAttribute("src", state.heldSrc);
      }
      ctx.events.emit("thumb:click", undefined);
      state?.cleanup();
    };
    overlay.addEventListener("click", onClick);

    const wrapper = ensurePositionedParent(ctx.mediaPlayer);
    wrapper.appendChild(overlay);

    const cleanup = () => {
      overlay.removeEventListener("click", onClick);
      overlay.remove();
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

function ensurePositionedParent(mediaPlayer: HTMLElement): HTMLElement {
  const parent = mediaPlayer.parentElement;
  if (parent) {
    const computed = parent.style.position;
    if (!computed) parent.style.position = "relative";
    return parent;
  }
  return mediaPlayer;
}
