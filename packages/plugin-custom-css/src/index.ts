import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";
import { sanitizeCustomCss, scopeCustomCss, validateTokens } from "./sanitize";

export { sanitizeCustomCss, scopeCustomCss, validateTokens, validateTokenValue } from "./sanitize";

export interface CustomCssConfig {
  enabled?: boolean;
  /**
   * Validated CSS custom properties applied as inline style on
   * `<player-stack>`. Keys must match `--ps-*`; values are passed through
   * `validateTokenValue` and silently dropped if they don't pass. Use this
   * surface for theming that comes from a CMS, API, or shortcode.
   */
  tokens?: Record<string, string>;
  /**
   * Raw CSS, auto-scoped to this player instance via CSS Nesting. Treated
   * as developer-authored code — requires `acknowledgeTrusted: true` to
   * take effect; without the flag the value is ignored and a console
   * warning is logged.
   */
  trustedCss?: string;
  /** Required to apply `trustedCss`. The verbose name is intentional. */
  acknowledgeTrusted?: boolean;
  /**
   * @deprecated Use `trustedCss` with `acknowledgeTrusted: true`. Logs a
   * deprecation warning and only applies when `acknowledgeTrusted` is set.
   */
  css?: string;
}

const STYLE_MARKER = "custom-css";
const PS_ID_ATTR = "data-ps-id";

let nextId = 0;

interface State {
  styleEl: HTMLStyleElement | null;
  ownsId: boolean;
  tokensApplied: string[];
}

const states = new WeakMap<PlayerstackContext, State>();

export const customCssPlugin: PlayerstackPlugin = {
  name: "custom-css",
  init(ctx: PlayerstackContext): void {
    const cfg = (ctx.config as { customCss?: CustomCssConfig }).customCss;
    if (!cfg?.enabled) return;

    const tokensApplied = applyTokens(ctx, cfg.tokens);
    const { styleEl, ownsId } = applyTrustedCss(ctx, cfg);

    if (tokensApplied.length === 0 && !styleEl) return;

    states.set(ctx, { styleEl, ownsId, tokensApplied });
  },
  destroy(ctx: PlayerstackContext): void {
    const state = states.get(ctx);
    if (!state) return;
    for (const name of state.tokensApplied) {
      ctx.container.style.removeProperty(name);
    }
    state.styleEl?.remove();
    if (state.ownsId) ctx.mediaPlayer.removeAttribute(PS_ID_ATTR);
    states.delete(ctx);
  },
};

function applyTokens(
  ctx: PlayerstackContext,
  tokens: Record<string, string> | undefined,
): string[] {
  const validated = validateTokens(tokens);
  for (const [name, value] of validated) {
    ctx.container.style.setProperty(name, value);
  }
  return validated.map(([name]) => name);
}

function applyTrustedCss(
  ctx: PlayerstackContext,
  cfg: CustomCssConfig,
): { styleEl: HTMLStyleElement | null; ownsId: boolean } {
  const rawSource = pickTrustedSource(cfg);
  if (!rawSource) return { styleEl: null, ownsId: false };

  const safe = sanitizeCustomCss(rawSource);
  if (!safe) return { styleEl: null, ownsId: false };

  let id = ctx.mediaPlayer.getAttribute(PS_ID_ATTR);
  let ownsId = false;
  if (!id) {
    id = `ps-${++nextId}`;
    ctx.mediaPlayer.setAttribute(PS_ID_ATTR, id);
    ownsId = true;
  }

  const scoped = scopeCustomCss(safe, `player-stack:has([${PS_ID_ATTR}="${id}"])`);
  const styleEl = document.createElement("style");
  styleEl.dataset.playerstack = STYLE_MARKER;
  styleEl.dataset.psId = id;
  styleEl.textContent = scoped;
  document.head.appendChild(styleEl);

  return { styleEl, ownsId };
}

function pickTrustedSource(cfg: CustomCssConfig): string | null {
  if (cfg.trustedCss && cfg.acknowledgeTrusted === true) return cfg.trustedCss;
  if (cfg.trustedCss && !cfg.acknowledgeTrusted) {
    console.warn(
      "[playerstack] customCss.trustedCss requires `acknowledgeTrusted: true`. Ignoring raw CSS. Use `tokens` for config-driven theming.",
    );
    return null;
  }
  if (cfg.css) {
    console.warn(
      "[playerstack] customCss.css is deprecated. Use `tokens` for config-driven theming, or `trustedCss` + `acknowledgeTrusted: true` for developer-authored CSS.",
    );
    if (cfg.acknowledgeTrusted === true) return cfg.css;
    return null;
  }
  return null;
}
