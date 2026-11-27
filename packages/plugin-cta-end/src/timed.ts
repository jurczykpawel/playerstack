// The modes behind `at`, `atPercent` and `frequency`. Loaded only when one of
// them is set, so keep runtime imports out of this module.
import type { PlayerstackContext } from "@playerstack/core";
import type { CtaEndConfig } from "./index";

/** Playback that begins no later than this (seconds) counts as starting from the beginning. */
const START_TOLERANCE = 2;

type Player = HTMLElement & {
  currentTime?: number;
  duration?: number;
  paused?: boolean;
  muted?: boolean;
  play?: () => Promise<void> | void;
  pause?: () => void;
};

export function startTimedCta(
  ctx: PlayerstackContext,
  cfg: CtaEndConfig,
  show: (extra?: HTMLElement) => HTMLElement,
  hide: () => void,
): () => void {
  const player = ctx.mediaPlayer as Player;
  const at = cfg.at ?? (cfg.atPercent === undefined ? "end" : undefined);
  const trigger = at === undefined ? { atPercent: cfg.atPercent } : { at };
  const midway = at !== "end";
  const once = midway || cfg.frequency !== undefined;
  const sessionKey =
    cfg.frequency === "session" ? `playerstack:cta-end:${ctx.config.src}` : undefined;
  const preview = (ctx.config as { preview?: { enabled?: boolean; src?: string } }).preview;
  // The muted autoplay preview of the main video is not the viewer watching.
  const previewing = () =>
    !!preview?.enabled && !preview.src && ctx.config.preload !== "none" && !!player.muted;
  let done = false;
  let card: HTMLElement | undefined;

  const seenThisSession = () => {
    try {
      return !!sessionKey && !!sessionStorage.getItem(sessionKey);
    } catch {
      return false;
    }
  };

  const skip = () => {
    ctx.events.emit("cta:skip", trigger);
    hide();
    try {
      const result = player.play?.();
      if (result instanceof Promise) result.catch(() => {});
    } catch {
      /* play() not yet on prototype */
    }
  };

  const fire = () => {
    if (once && (done || seenThisSession())) return;
    done = true;
    try {
      if (sessionKey) sessionStorage.setItem(sessionKey, "1");
    } catch {
      /* Storage is optional. */
    }
    let button: HTMLButtonElement | undefined;
    if (midway) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "playerstack-cta-skip";
      button.textContent = cfg.skipLabel || "Skip";
      button.style.cssText =
        "background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.4);padding:8px 16px;border-radius:6px;cursor:pointer;";
      button.addEventListener("click", skip);
      player.pause?.();
    }
    const overlay = show(button);
    if (midway) {
      card = overlay;
      overlay.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        skip();
      });
    }
    ctx.events.emit("cta:show", trigger);
  };

  const onStart = () => {
    if (done || previewing()) return;
    if ((player.currentTime ?? 0) <= START_TOLERANCE) fire();
    // Resumed further in (for example a saved position): the opening card is moot.
    else done = true;
  };
  const onTime = () => {
    if (previewing()) return;
    const time = player.currentTime ?? 0;
    const duration = player.duration ?? 0;
    const reached =
      typeof at === "number"
        ? time >= at
        : duration > 0 && (time / duration) * 100 >= cfg.atPercent!;
    if (reached) fire();
  };
  // Another overlay or the host page may resume playback while the card is open.
  const onPlay = () => {
    if (card?.isConnected) player.pause?.();
  };
  const onNewSource = () => {
    done = false;
  };

  const listeners: [string, () => void][] = [
    at === "end" ? ["ended", fire] : at === "start" ? ["playing", onStart] : ["timeupdate", onTime],
    ["play", onPlay],
    ["emptied", onNewSource],
  ];
  for (const [name, listener] of listeners) player.addEventListener(name, listener);
  if (at === "start" && player.paused === false) onStart();

  return () => {
    for (const [name, listener] of listeners) player.removeEventListener(name, listener);
  };
}
