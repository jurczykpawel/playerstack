import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export interface StickyConfig {
  enabled?: boolean;
  /** Threshold for IntersectionObserver. Default 0.1. */
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
  height: auto;
  aspect-ratio: 16 / 9;
  z-index: 9999;
  box-shadow: 0 12px 36px rgba(0,0,0,0.5);
  border-radius: 8px;
  overflow: hidden;
}
.playerstack-sticky-close {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: rgba(0,0,0,0.8);
  color: #fff;
  font: 14px/1 sans-serif;
  cursor: pointer;
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
    let closeBtn: HTMLButtonElement | null = null;

    const ensureClose = () => {
      if (closeBtn) return;
      closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "playerstack-sticky-close";
      closeBtn.textContent = "×";
      closeBtn.setAttribute("aria-label", "Dismiss sticky player");
      closeBtn.addEventListener("click", () => {
        dismissed = true;
        ctx.container.classList.remove(STICKY_CLASS);
        observer.disconnect();
        closeBtn?.remove();
        closeBtn = null;
      });
      ctx.container.appendChild(closeBtn);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (dismissed) return;
        for (const entry of entries) {
          const player = ctx.mediaPlayer as HTMLElement & { paused?: boolean };
          if (!entry.isIntersecting && player.paused !== true) {
            ctx.container.classList.add(STICKY_CLASS);
            ensureClose();
          } else if (entry.isIntersecting) {
            ctx.container.classList.remove(STICKY_CLASS);
            closeBtn?.remove();
            closeBtn = null;
          }
        }
      },
      { threshold: cfg.threshold ?? 0.1 },
    );
    observer.observe(ctx.container);

    states.set(ctx, {
      observer,
      closeBtn,
      cleanup: () => {
        ctx.container.classList.remove(STICKY_CLASS);
        observer.disconnect();
        closeBtn?.remove();
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};
