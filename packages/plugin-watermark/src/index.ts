import { isSafeHttpUrl, type PlayerstackPlugin, type PlayerstackContext } from "@playerstack/core";

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
  /**
   * Distance from the corner in px; default 16. Bottom corners also keep at least
   * `--ps-control-bar-clearance` (default 48px) so the control bar stays clickable.
   */
  margin?: number;
  /** Image width in px; default 80. Ignored for text mode. */
  width?: number;
  /**
   * Seconds between moves to a random spot inside the frame, above the control bar;
   * at least 1. Off by default. When on, `position` is ignored.
   */
  moveInterval?: number;
  /** How a move looks, default "smooth". Reduced motion always jumps. */
  moveTransition?: "smooth" | "jump";
  /** Put the overlay back if it is removed from the player. A deterrent, not DRM. */
  reinsert?: boolean;
}

const DEFAULT_OPACITY = 0.7;
const DEFAULT_MARGIN = 16;
const DEFAULT_WIDTH = 80;
const MIN_MOVE_SECONDS = 1;
// Browser timers fire immediately beyond a 32-bit millisecond delay.
const MAX_MOVE_SECONDS = 2_147_483;
const SMOOTH_MOVE = "left 0.8s ease, top 0.8s ease, transform 0.8s ease";

interface State {
  overlay: HTMLElement;
  timer?: ReturnType<typeof setInterval>;
  observer?: MutationObserver;
}

const states = new WeakMap<PlayerstackContext, State>();

export const watermarkPlugin: PlayerstackPlugin = {
  name: "watermark",
  init(ctx: PlayerstackContext): void {
    const cfg = (ctx.config as { watermark?: WatermarkConfig }).watermark;
    if (!cfg?.enabled) return;
    // Image mode requires a parseable http(s) URL; text mode is unaffected.
    const safeImageSrc = isSafeHttpUrl(cfg.src) ? cfg.src : undefined;
    if (!safeImageSrc && !cfg.text) return;

    const overlay = buildOverlay(cfg, safeImageSrc);
    // Mount on <player-stack> directly — has position:relative + aspect-ratio
    // + overflow from core DEFAULT_STYLES. Mounting inside <media-controller>
    // would tangle with Mux's shadow DOM stacking.
    ctx.container.appendChild(overlay);

    const state: State = { overlay };
    const seconds = moveSeconds(cfg);
    if (seconds) {
      state.timer = setInterval(() => {
        const jump =
          cfg.moveTransition === "jump" ||
          globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        overlay.style.transition = jump ? "none" : SMOOTH_MOVE;
        applyRandomSpot(overlay, marginPx(cfg));
      }, seconds * 1000);
    }
    if (cfg.reinsert) {
      state.observer = new MutationObserver(() => {
        if (overlay.parentNode !== ctx.container) ctx.container.appendChild(overlay);
      });
      state.observer.observe(ctx.container, { childList: true });
    }
    states.set(ctx, state);
  },
  destroy(ctx: PlayerstackContext): void {
    const state = states.get(ctx);
    if (!state) return;
    clearInterval(state.timer);
    state.observer?.disconnect();
    state.overlay.remove();
    states.delete(ctx);
  },
};

function buildOverlay(cfg: WatermarkConfig, safeImageSrc: string | undefined): HTMLElement {
  const safeHref = isSafeHttpUrl(cfg.href) ? cfg.href : undefined;
  const root = document.createElement(safeHref ? "a" : "div");
  root.className = "playerstack-watermark";

  if (root instanceof HTMLAnchorElement && safeHref) {
    root.href = safeHref;
    root.target = "_blank";
    root.rel = "noopener noreferrer";
  }

  const margin = marginPx(cfg);
  const opacity = clampOpacity(cfg.opacity);

  root.style.cssText =
    "position:absolute;display:inline-flex;align-items:center;justify-content:center;" +
    `pointer-events:${safeHref ? "auto" : "none"};z-index:2;color:#fff;font-size:12px;line-height:1;` +
    "text-shadow:0 1px 2px rgba(0,0,0,0.6);text-decoration:none;" +
    `opacity:${opacity};`;
  if (moveSeconds(cfg)) {
    // Without an explicit width, text near the right edge would wrap into a thin column.
    root.style.width = "max-content";
    root.style.maxWidth = `calc(100% - 2 * ${margin})`;
    root.style.boxSizing = "border-box";
    root.style.overflowWrap = "anywhere";
    applyRandomSpot(root, margin);
  } else {
    applyPosition(root, cfg.position ?? "bottom-right", margin);
  }

  if (safeImageSrc) {
    const img = document.createElement("img");
    img.src = safeImageSrc;
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

function marginPx(cfg: WatermarkConfig): string {
  return `${Number.isFinite(cfg.margin) ? Math.max(0, cfg.margin as number) : DEFAULT_MARGIN}px`;
}

function moveSeconds({ moveInterval }: WatermarkConfig): number {
  if (!Number.isFinite(moveInterval) || (moveInterval as number) <= 0) return 0;
  return Math.min(MAX_MOVE_SECONDS, Math.max(MIN_MOVE_SECONDS, moveInterval as number));
}

// The bottom edge is shared with the control bar, which must stay clickable.
function bottomClearance(margin: string): string {
  return `max(${margin}, var(--ps-control-bar-clearance, 48px))`;
}

function applyPosition(el: HTMLElement, position: WatermarkPosition, margin: string): void {
  const [vertical, horizontal] = position.split("-") as ["top" | "bottom", "left" | "right"];
  el.style[vertical] = vertical === "bottom" ? `calc(${bottomClearance(margin)})` : margin;
  el.style[horizontal] = margin;
}

// Offsetting by a share of the free space and shifting back by the same share of
// its own size keeps the overlay inside the frame at any size, without measuring.
function applyRandomSpot(el: HTMLElement, margin: string): void {
  const x = Math.random();
  const y = Math.random();
  el.style.left = `calc(${margin} + (100% - 2 * ${margin}) * ${x})`;
  el.style.top = `calc(${margin} + (100% - ${margin} - ${bottomClearance(margin)}) * ${y})`;
  el.style.transform = `translate(${-100 * x}%, ${-100 * y}%)`;
}

function clampOpacity(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(DEFAULT_OPACITY);
  return String(Math.max(0, Math.min(1, value)));
}
