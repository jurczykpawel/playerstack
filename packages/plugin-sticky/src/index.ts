import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

const POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;

export interface StickyConfig {
  enabled?: boolean;
  /** Threshold for IntersectionObserver. Default 0.15. */
  threshold?: number;
  /** Viewport corner of the pinned player. Default "bottom-right". */
  position?: (typeof POSITIONS)[number];
  /**
   * Distance from both corner edges in CSS pixels. Default 16. On narrow screens
   * it is only the gap under the full-width player (default 8).
   */
  offset?: number;
}

interface State {
  observer: IntersectionObserver;
  closeBtn: HTMLButtonElement | null;
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, State>();

const STICKY_CLASS = "playerstack-sticky";
const OFFSET_VAR = "--playerstack-sticky-offset";
const EDGE = `var(${OFFSET_VAR}, 16px)`;
/** Below this viewport width the pinned player spans the screen: a corner box would be under 240 px. */
const NARROW = "(max-width: 599.98px)";
/** Overlays whose content does not fit a pinned 16:9 box without scrolling. */
const TALL_OVERLAYS = ".playerstack-cta, .playerstack-email-gate, .playerstack-intro-card";

function cornerRule(position: (typeof POSITIONS)[number]): string {
  const [vertical, horizontal] = position.split("-");
  return `.${STICKY_CLASS}[data-playerstack-sticky-position="${position}"] {
  top: auto;
  right: auto;
  bottom: auto;
  left: auto;
  ${vertical}: ${EDGE};
  ${horizontal}: ${EDGE};
}`;
}

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("playerstack-sticky-styles")) return;
  const style = document.createElement("style");
  style.id = "playerstack-sticky-styles";
  style.textContent = `
.${STICKY_CLASS} {
  position: fixed !important;
  bottom: ${EDGE};
  right: ${EDGE};
  width: min(360px, 40vw);
  aspect-ratio: 16 / 9;
  z-index: 9999;
  max-width: calc(100% - 2 * ${EDGE}) !important;
  min-width: 0 !important;
  margin: 0 !important;
  background: #000;
  box-shadow: 0 12px 36px rgba(0,0,0,0.5);
  border-radius: 8px;
  overflow: hidden;
}
.${STICKY_CLASS} media-controller {
  position: absolute !important;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
}
.playerstack-sticky-close {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10001;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0,0,0,0.8) 0 14px, transparent 14.5px);
  color: #fff;
  font: 18px/1 sans-serif;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.${STICKY_CLASS} > .playerstack-action-bar {
  margin-top: 40px;
}
.${STICKY_CLASS} > .playerstack-intro-card > .playerstack-intro-card-close {
  right: 52px !important;
}
${POSITIONS.slice(1).map(cornerRule).join("\n")}
@media ${NARROW} {
  .${STICKY_CLASS}.${STICKY_CLASS} {
    top: auto;
    left: calc(8px + env(safe-area-inset-left, 0px));
    right: calc(8px + env(safe-area-inset-right, 0px));
    bottom: calc(var(${OFFSET_VAR}, 8px) + env(safe-area-inset-bottom, 0px));
    width: auto !important;
    max-width: none !important;
    height: auto !important;
    max-height: none !important;
    min-height: 0 !important;
  }
}
.${STICKY_CLASS}.${STICKY_CLASS}:has(> :is(${TALL_OVERLAYS})) {
  aspect-ratio: auto;
  height: min(60vh, 420px) !important;
  height: min(60dvh, 420px) !important;
}
`;
  document.head.appendChild(style);
}

/** Overlays make their siblings inert; the pin must stay dismissible above them. */
function keepUsable(button: HTMLElement): void {
  const attributes = ["inert", "aria-hidden"];
  new MutationObserver(() => {
    for (const name of attributes) button.removeAttribute(name);
  }).observe(button, { attributeFilter: attributes });
}

export const stickyPlugin: PlayerstackPlugin = {
  name: "sticky",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { sticky?: StickyConfig }).sticky;
    if (!cfg?.enabled) return;

    ensureStyles();

    let dismissed = false;
    let isSticky = false;
    let placeholder: HTMLElement | null = null;
    let closeBtn: HTMLButtonElement | null = null;

    const enterThreshold = cfg.threshold ?? 0.15;
    // Hysteresis: exit sticky only when mostly visible again.
    const exitThreshold = Math.min(Math.max(enterThreshold * 4, 0.5), 1.0);

    const position = POSITIONS.find((value) => value === cfg.position);
    const offset =
      typeof cfg.offset === "number" && Number.isFinite(cfg.offset) && cfg.offset >= 0
        ? cfg.offset
        : undefined;

    const ensureClose = () => {
      if (closeBtn) return;
      closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "playerstack-sticky-close";
      closeBtn.textContent = "×";
      closeBtn.setAttribute("aria-label", "Dismiss sticky player");
      closeBtn.addEventListener("click", () => {
        dismissed = true;
        leaveSticky();
        observer.disconnect();
      });
      keepUsable(closeBtn);
      ctx.container.appendChild(closeBtn);
    };

    const goSticky = () => {
      isSticky = true;
      // Unobserve BEFORE any DOM change. Adding position:fixed makes the element
      // always intersect the viewport (ratio=1), which would fire the "exit sticky"
      // branch and cause an add→remove→add feedback loop (= flicker).
      observer.unobserve(ctx.container);
      // Snapshot dimensions so the placeholder holds the space in the layout.
      const w = ctx.container.offsetWidth;
      const h = ctx.container.offsetHeight;
      placeholder = document.createElement("div");
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.style.cssText = `width:${w}px;height:${h}px;visibility:hidden;pointer-events:none;flex-shrink:0;`;
      ctx.container.parentElement?.insertBefore(placeholder, ctx.container);
      if (position) ctx.container.dataset.playerstackStickyPosition = position;
      if (offset !== undefined) ctx.container.style.setProperty(OFFSET_VAR, `${offset}px`);
      ctx.container.classList.add(STICKY_CLASS);
      observer.observe(placeholder);
      ensureClose();
    };

    const leaveSticky = () => {
      isSticky = false;
      ctx.container.classList.remove(STICKY_CLASS);
      delete ctx.container.dataset.playerstackStickyPosition;
      if (offset !== undefined) ctx.container.style.removeProperty(OFFSET_VAR);
      closeBtn?.remove();
      closeBtn = null;
      if (placeholder) {
        observer.unobserve(placeholder);
        placeholder.remove();
        placeholder = null;
      }
      if (!dismissed) observer.observe(ctx.container);
    };

    const isFullscreen = () => {
      const root = ctx.container.getRootNode() as Document & {
        webkitFullscreenElement?: Element | null;
      };
      const element = root.fullscreenElement ?? root.webkitFullscreenElement;
      return !!element && ctx.container.contains(element);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (dismissed) return;
        for (const entry of entries) {
          const ratio = entry.intersectionRatio;
          const player = ctx.mediaPlayer as HTMLElement & { paused?: boolean };
          if (!isSticky && ratio < enterThreshold && player.paused !== true && !isFullscreen()) {
            goSticky();
          } else if (isSticky && ratio > exitThreshold) {
            leaveSticky();
          }
        }
      },
      { threshold: [0, enterThreshold, exitThreshold, 1.0] },
    );
    observer.observe(ctx.container);

    const onFullscreenChange = () => {
      if (isFullscreen()) {
        if (isSticky) leaveSticky();
      } else if (!dismissed && !isSticky) {
        // Observing again reports the current position, which may not have crossed
        // a threshold since the player went fullscreen.
        observer.unobserve(ctx.container);
        observer.observe(ctx.container);
      }
    };
    const fullscreenEvents = ["fullscreenchange", "webkitfullscreenchange"];
    const doc = ctx.container.ownerDocument;
    for (const name of fullscreenEvents) doc.addEventListener(name, onFullscreenChange);

    states.set(ctx, {
      observer,
      closeBtn,
      cleanup: () => {
        for (const name of fullscreenEvents) doc.removeEventListener(name, onFullscreenChange);
        leaveSticky();
        observer.disconnect();
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};
