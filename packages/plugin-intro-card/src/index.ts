import {
  activateOverlay,
  buildSafeCtaUrl,
  isSafeHttpUrl,
  sanitizeHtml,
  type PlayerstackPlugin,
  type PlayerstackContext,
} from "@playerstack/core";

export type IntroCardPosition = "fullscreen" | "bottom" | "center";
export type IntroCardTheme = "dark" | "light" | "transparent";

export interface IntroCardCta {
  label: string;
  url: string;
  utm?: string;
}

export interface IntroCardConfig {
  enabled?: boolean;
  badge?: string;
  title?: string;
  subtitle?: string;
  /** HTML rendered above the play button. Routed through the core sanitizer. */
  html?: string;
  cta?: IntroCardCta;
  /** Optional background image for the overlay. */
  image?: string;
  /** Default "fullscreen" — covers the whole player. */
  position?: IntroCardPosition;
  /** Default "dark" — semi-opaque black panel over the video. */
  theme?: IntroCardTheme;
  /** Default false — only the play button or CTA dismiss the card. */
  dismissible?: boolean;
}

interface State {
  overlay: HTMLElement;
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, State>();

export const introCardPlugin: PlayerstackPlugin = {
  name: "intro-card",
  init(ctx: PlayerstackContext): void {
    const cfg = (ctx.config as { introCard?: IntroCardConfig }).introCard;
    if (!cfg?.enabled) return;

    const overlay = buildOverlay(cfg);
    // Mount on <player-stack> directly — has position:relative + aspect-ratio
    // + overflow from core DEFAULT_STYLES. Mounting inside <media-controller>
    // would tangle with Mux's shadow DOM stacking.
    ctx.container.appendChild(overlay);
    const release = activateOverlay(ctx.container, overlay);

    const playBtn = overlay.querySelector(
      ".playerstack-intro-card-play",
    ) as HTMLButtonElement | null;
    const onPlay = () => {
      ctx.events.emit("intro-card:play-click", undefined);
      const player = ctx.mediaPlayer as HTMLElement & {
        play?: () => Promise<void> | void;
      };
      try {
        const result = player.play?.();
        if (result instanceof Promise) result.catch(() => {});
      } catch {
        /* play() not yet on prototype */
      }
      removeOverlay();
    };
    playBtn?.addEventListener("click", onPlay);

    const ctaLink = overlay.querySelector(
      "a.playerstack-intro-card-cta",
    ) as HTMLAnchorElement | null;
    const onCta = () => {
      ctx.events.emit("intro-card:cta-click", { label: cfg.cta?.label, url: ctaLink?.href });
    };
    ctaLink?.addEventListener("click", onCta);

    const closeBtn = overlay.querySelector(
      ".playerstack-intro-card-close",
    ) as HTMLButtonElement | null;
    const onClose = () => {
      ctx.events.emit("intro-card:dismiss", undefined);
      removeOverlay();
    };
    closeBtn?.addEventListener("click", onClose);

    const removeOverlay = () => {
      release();
      overlay.remove();
    };

    states.set(ctx, {
      overlay,
      cleanup: () => {
        playBtn?.removeEventListener("click", onPlay);
        ctaLink?.removeEventListener("click", onCta);
        closeBtn?.removeEventListener("click", onClose);
        removeOverlay();
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};

function buildOverlay(cfg: IntroCardConfig): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "playerstack-intro-card";
  overlay.setAttribute("data-position", cfg.position ?? "fullscreen");
  overlay.setAttribute("data-theme", cfg.theme ?? "dark");
  overlay.style.cssText = baseOverlayCss(cfg.position ?? "fullscreen", cfg.theme ?? "dark");

  if (isSafeHttpUrl(cfg.image)) {
    const bg = document.createElement("img");
    bg.className = "playerstack-intro-card-bg";
    bg.src = cfg.image;
    bg.alt = "";
    bg.loading = "lazy";
    bg.decoding = "async";
    bg.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;";
    overlay.appendChild(bg);
  }

  const content = document.createElement("div");
  content.className = "playerstack-intro-card-content";
  content.style.cssText =
    "position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;" +
    "gap:14px;padding:32px;text-align:center;max-width:640px;width:100%;min-width:0;margin:auto;flex-shrink:0;box-sizing:border-box;overflow-wrap:anywhere;";

  if (cfg.badge) {
    const badge = document.createElement("span");
    badge.className = "playerstack-intro-card-badge";
    badge.textContent = cfg.badge;
    badge.style.cssText =
      "display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;" +
      "font-weight:700;letter-spacing:0.06em;text-transform:uppercase;" +
      "background:var(--ps-accent,rgba(255,255,255,0.18));color:#fff;";
    content.appendChild(badge);
  }

  if (cfg.title) {
    const title = document.createElement("h2");
    title.className = "playerstack-intro-card-title";
    title.textContent = cfg.title;
    title.style.cssText =
      "margin:0;font-size:clamp(22px,3.6vw,40px);line-height:1.15;font-weight:700;color:inherit;";
    content.appendChild(title);
  }

  if (cfg.subtitle) {
    const subtitle = document.createElement("p");
    subtitle.className = "playerstack-intro-card-subtitle";
    subtitle.textContent = cfg.subtitle;
    subtitle.style.cssText =
      "margin:0;font-size:clamp(14px,1.6vw,18px);line-height:1.4;opacity:0.85;color:inherit;";
    content.appendChild(subtitle);
  }

  if (cfg.html) {
    const custom = document.createElement("div");
    custom.className = "playerstack-intro-card-html";
    custom.innerHTML = sanitizeHtml(cfg.html);
    content.appendChild(custom);
  }

  const playBtn = buildPlayButton();
  content.appendChild(playBtn);

  const safeCtaUrl = buildSafeCtaUrl(cfg.cta?.url, cfg.cta?.utm);
  if (safeCtaUrl && cfg.cta) {
    const cta = document.createElement("a");
    cta.className = "playerstack-intro-card-cta";
    cta.href = safeCtaUrl;
    cta.target = "_blank";
    cta.rel = "noopener noreferrer";
    cta.textContent = cfg.cta.label;
    cta.style.cssText =
      "padding:10px 18px;background:var(--ps-accent,#008aff);color:#fff;border-radius:8px;" +
      "text-decoration:none;font-weight:600;font-size:15px;";
    content.appendChild(cta);
  }

  if (cfg.dismissible) {
    const close = document.createElement("button");
    close.type = "button";
    close.className = "playerstack-intro-card-close";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";
    close.style.cssText =
      "position:absolute;top:12px;right:12px;z-index:2;width:36px;height:36px;" +
      "border:none;border-radius:50%;background:rgba(0,0,0,0.4);color:#fff;" +
      "font-size:22px;line-height:1;cursor:pointer;";
    overlay.appendChild(close);
  }

  overlay.appendChild(content);
  return overlay;
}

function buildPlayButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "playerstack-intro-card-play";
  btn.setAttribute("aria-label", "Play video");
  btn.style.cssText =
    "width:84px;height:84px;padding:0;display:inline-flex;align-items:center;" +
    "justify-content:center;border:none;border-radius:50%;cursor:pointer;color:#fff;" +
    "background:var(--ps-accent,rgba(0,0,0,0.65));box-shadow:0 6px 20px rgba(0,0,0,0.35);" +
    "transition:transform 160ms ease, background-color 160ms ease;";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "36");
  svg.setAttribute("height", "36");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "display:block;margin-left:3px;";
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M8 5v14l11-7z");
  svg.appendChild(path);
  btn.appendChild(svg);
  return btn;
}

function baseOverlayCss(position: IntroCardPosition, theme: IntroCardTheme): string {
  const positionCss = {
    fullscreen: "position:absolute;inset:0;",
    center:
      "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(80%,560px);border-radius:14px;",
    bottom: "position:absolute;left:0;right:0;bottom:0;",
  }[position];
  const themeCss = {
    dark: "background:rgba(0,0,0,0.78);color:#fff;",
    light: "background:rgba(255,255,255,0.94);color:#0b0d12;",
    transparent: "background:transparent;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.6);",
  }[theme];
  return (
    positionCss +
    themeCss +
    "z-index:3;display:flex;align-items:flex-start;justify-content:center;max-height:100%;box-sizing:border-box;" +
    "overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;cursor:default;font-family:inherit;"
  );
}
