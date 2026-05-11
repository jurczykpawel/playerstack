import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";
import { sanitizeCustomCss, scopeCustomCss } from "./sanitize";

export { sanitizeCustomCss, scopeCustomCss } from "./sanitize";

export interface CustomCssConfig {
  enabled?: boolean;
  /** Raw CSS. Auto-scoped to this player instance via CSS Nesting. */
  css?: string;
}

const STYLE_MARKER = "custom-css";
const PS_ID_ATTR = "data-ps-id";

let nextId = 0;

interface State {
  styleEl: HTMLStyleElement;
  ownsId: boolean;
}

const states = new WeakMap<PlayerstackContext, State>();

export const customCssPlugin: PlayerstackPlugin = {
  name: "custom-css",
  init(ctx: PlayerstackContext): void {
    const cfg = (ctx.config as { customCss?: CustomCssConfig }).customCss;
    if (!cfg?.enabled) return;
    const safe = cfg.css ? sanitizeCustomCss(cfg.css) : null;
    if (!safe) return;

    let id = ctx.mediaPlayer.getAttribute(PS_ID_ATTR);
    let ownsId = false;
    if (!id) {
      id = `ps-${++nextId}`;
      ctx.mediaPlayer.setAttribute(PS_ID_ATTR, id);
      ownsId = true;
    }

    // The data-ps-id attribute lives on the inner mediaPlayer element (matching
    // controls-policy convention), so we scope via :has() to find the
    // <player-stack> ancestor that contains a descendant with this id.
    const scoped = scopeCustomCss(safe, `player-stack:has([${PS_ID_ATTR}="${id}"])`);
    const styleEl = document.createElement("style");
    styleEl.dataset.playerstack = STYLE_MARKER;
    styleEl.dataset.psId = id;
    styleEl.textContent = scoped;
    document.head.appendChild(styleEl);

    states.set(ctx, { styleEl, ownsId });
  },
  destroy(ctx: PlayerstackContext): void {
    const state = states.get(ctx);
    if (!state) return;
    state.styleEl.remove();
    if (state.ownsId) ctx.mediaPlayer.removeAttribute(PS_ID_ATTR);
    states.delete(ctx);
  },
};
