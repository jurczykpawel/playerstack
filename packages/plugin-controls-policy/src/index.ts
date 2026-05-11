import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";
import { buildPolicy, type ControlsPolicyConfig } from "./policy";

export { buildPolicy, ALL_CONTROLS } from "./policy";
export type { ControlName, ControlsPolicyConfig, PolicyResult } from "./policy";

const STYLE_MARKER = "controls-policy";
const PS_ID_ATTR = "data-ps-id";

let nextId = 0;

interface PolicyState {
  id: string;
  varsApplied: string[];
  styleEl: HTMLStyleElement | null;
}

const states = new WeakMap<PlayerstackContext, PolicyState>();

export const controlsPolicyPlugin: PlayerstackPlugin = {
  name: "controls-policy",
  async init(ctx: PlayerstackContext): Promise<void> {
    const controls = (ctx.config as { controls?: ControlsPolicyConfig }).controls;
    if (!controls) return;

    const { vars, hideCss } = buildPolicy(controls);
    const varsApplied: string[] = [];

    // CSS vars must live on <player-stack> (the container) so they cascade to
    // <media-controller> and <media-control-bar>, which are siblings of the
    // inner <video> — not descendants. Pre-Mux migration ctx.mediaPlayer was
    // <media-player> wrapping the whole tree, so vars cascaded; post-migration
    // the inner element is a leaf, so we anchor on the container instead.
    for (const [name, value] of Object.entries(vars)) {
      ctx.container.style.setProperty(name, value);
      varsApplied.push(name);
    }

    let styleEl: HTMLStyleElement | null = null;
    let id = ctx.mediaPlayer.getAttribute(PS_ID_ATTR);
    if (hideCss) {
      if (!id) {
        id = `ps-${++nextId}`;
        ctx.mediaPlayer.setAttribute(PS_ID_ATTR, id);
      }
      // ctx.mediaPlayer is now the inner <video|youtube-video|...> element.
      // Hide-targets (media-control-bar buttons) live as siblings inside the
      // <media-controller>, so we scope by the player-stack ancestor that
      // shares the data-ps-id attribute via the plugin-tagged inner element.
      const scopedCss = scopeCss(hideCss, `player-stack:has([${PS_ID_ATTR}="${id}"])`);
      styleEl = document.createElement("style");
      styleEl.dataset.playerstack = STYLE_MARKER;
      styleEl.dataset.psId = id;
      styleEl.textContent = scopedCss;
      document.head.appendChild(styleEl);
    }

    states.set(ctx, { id: id ?? "", varsApplied, styleEl });
  },
  destroy(ctx: PlayerstackContext): void {
    const state = states.get(ctx);
    if (!state) return;
    for (const name of state.varsApplied) {
      ctx.container.style.removeProperty(name);
    }
    state.styleEl?.remove();
    if (state.id) ctx.mediaPlayer.removeAttribute(PS_ID_ATTR);
    states.delete(ctx);
  },
};

/**
 * Prefix every selector in a CSS rule list with a scope.
 * Naive but enough for our hide-rules: comma-separated selectors, single block.
 */
function scopeCss(css: string, scope: string): string {
  const braceIdx = css.indexOf("{");
  if (braceIdx < 0) return css;
  const selectors = css
    .slice(0, braceIdx)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `${scope} ${s}`)
    .join(",\n");
  return `${selectors} ${css.slice(braceIdx)}`;
}
