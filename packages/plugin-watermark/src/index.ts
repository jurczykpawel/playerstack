import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export type WatermarkPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface WatermarkConfig {
  enabled?: boolean;
  /** Image URL for the overlay. Mutually exclusive with `text`. */
  src?: string;
  /** Plain-text overlay (e.g. "© ACME 2026"). Mutually exclusive with `src`. */
  text?: string;
  /** Optional click-through link. Must be http(s); other schemes are ignored. */
  href?: string;
  /** Corner placement, default "bottom-right". */
  position?: WatermarkPosition;
  /** 0–1; out-of-range values clamp, invalid values fall back to default 0.7. */
  opacity?: number;
  /** Distance from the corner in px; default 16. */
  margin?: number;
  /** Image width in px; default 80. Ignored for text mode. */
  width?: number;
}

const DEFAULT_OPACITY = 0.7;
const DEFAULT_MARGIN = 16;
const DEFAULT_WIDTH = 80;

interface State {
  overlay: HTMLElement;
}

const states = new WeakMap<PlayerstackContext, State>();

export const watermarkPlugin: PlayerstackPlugin = {
  name: "watermark",
  init(ctx: PlayerstackContext): void {
    const cfg = (ctx.config as { watermark?: WatermarkConfig }).watermark;
    if (!cfg?.enabled) return;
    if (!cfg.src && !cfg.text) return;

    const overlay = buildOverlay(cfg);
    // Mount on <player-stack> directly — has position:relative + aspect-ratio
    // + overflow from core DEFAULT_STYLES. Mounting inside <media-controller>
    // would tangle with Mux's shadow DOM stacking.
    ctx.container.appendChild(overlay);

    states.set(ctx, { overlay });
  },
  destroy(ctx: PlayerstackContext): void {
    const state = states.get(ctx);
    if (!state) return;
    state.overlay.remove();
    states.delete(ctx);
  },
};

function buildOverlay(cfg: WatermarkConfig): HTMLElement {
  const safeHref = isHttpUrl(cfg.href) ? cfg.href : undefined;
  const root = document.createElement(safeHref ? "a" : "div");
  root.className = "playerstack-watermark";

  if (root instanceof HTMLAnchorElement && safeHref) {
    root.href = safeHref;
    root.target = "_blank";
    root.rel = "noopener noreferrer";
  }

  const position = cfg.position ?? "bottom-right";
  const margin = `${Number.isFinite(cfg.margin) ? Math.max(0, cfg.margin as number) : DEFAULT_MARGIN}px`;
  const opacity = clampOpacity(cfg.opacity);

  root.style.cssText =
    "position:absolute;display:inline-flex;align-items:center;justify-content:center;" +
    "pointer-events:auto;z-index:2;color:#fff;font-size:12px;line-height:1;" +
    "text-shadow:0 1px 2px rgba(0,0,0,0.6);text-decoration:none;" +
    `opacity:${opacity};`;
  applyPosition(root, position, margin);

  if (cfg.src) {
    const img = document.createElement("img");
    img.src = cfg.src;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    const widthPx = Number.isFinite(cfg.width) ? Math.max(1, cfg.width as number) : DEFAULT_WIDTH;
    img.style.cssText = `width:${widthPx}px;height:auto;display:block;`;
    root.appendChild(img);
  } else if (cfg.text) {
    root.textContent = cfg.text;
    root.style.padding = "4px 8px";
    root.style.background = "rgba(0,0,0,0.45)";
    root.style.borderRadius = "4px";
  }

  return root;
}

function applyPosition(el: HTMLElement, position: WatermarkPosition, margin: string): void {
  const [vertical, horizontal] = position.split("-") as ["top" | "bottom", "left" | "right"];
  el.style[vertical] = margin;
  el.style[horizontal] = margin;
}

function clampOpacity(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(DEFAULT_OPACITY);
  return String(Math.max(0, Math.min(1, value)));
}

function isHttpUrl(href: string | undefined): href is string {
  if (!href) return false;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
