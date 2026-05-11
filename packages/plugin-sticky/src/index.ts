import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export interface StickyConfig {
  enabled?: boolean;
  /** Threshold for IntersectionObserver. Default 0.15. */
  threshold?: number;
}

interface State {
  observer: IntersectionObserver;
  closeBtn: HTMLButtonElement | null;
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, State>();

const STICKY_CLASS = "playerstack-sticky";

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("playerstack-sticky-styles")) return;
  const style = document.createElement("style");
  style.id = "playerstack-sticky-styles";
  style.textContent = `
.${STICKY_CLASS} {
  position: fixed !important;
  bottom: 16px;
  right: 16px;
  width: min(360px, 40vw);
  aspect-ratio: 16 / 9;
  z-index: 9999;
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
  top: 6px;
  right: 6px;
  z-index: 10001;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: rgba(0,0,0,0.8);
  color: #fff;
  font: 14px/1 sans-serif;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
`;
  document.head.appendChild(style);
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
      ctx.container.classList.add(STICKY_CLASS);
      observer.observe(placeholder);
      ensureClose();
    };

    const leaveSticky = () => {
      isSticky = false;
      ctx.container.classList.remove(STICKY_CLASS);
      closeBtn?.remove();
      closeBtn = null;
      if (placeholder) {
        observer.unobserve(placeholder);
        placeholder.remove();
        placeholder = null;
      }
      if (!dismissed) observer.observe(ctx.container);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (dismissed) return;
        for (const entry of entries) {
          const ratio = entry.intersectionRatio;
          const player = ctx.mediaPlayer as HTMLElement & { paused?: boolean };
          if (!isSticky && ratio < enterThreshold && player.paused !== true) {
            goSticky();
          } else if (isSticky && ratio > exitThreshold) {
            leaveSticky();
          }
        }
      },
      { threshold: [0, enterThreshold, exitThreshold, 1.0] },
    );
    observer.observe(ctx.container);

    states.set(ctx, {
      observer,
      closeBtn,
      cleanup: () => {
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
