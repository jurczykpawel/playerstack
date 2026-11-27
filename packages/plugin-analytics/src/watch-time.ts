import type { PlayerstackContext } from "@playerstack/core";

/** `data` of a `watch_progress` event. Seconds are media seconds, rounded to 0.1. */
export interface WatchProgress {
  /** Furthest position reached by playing (seeking alone does not move it). */
  maxPosition: number;
  /** `maxPosition` of the previous event of this playback, `0` in the first one. */
  previousMaxPosition: number;
  /** Seconds played so far, rewatched parts included, skipped parts excluded. */
  watchedSeconds: number;
  /** Seconds played since the previous event. */
  watchedDelta: number;
  duration: number;
  /** `maxPosition` as a whole percent of `duration`, rounded down. */
  percent: number;
}

const MIN_INTERVAL = 5;
/** Allowed timer jitter between the media position and the wall clock. */
const SLACK_SECONDS = 1;

const round = (seconds: number) => Math.round(seconds * 10) / 10;

/**
 * Measure real playback and report it in batches: on pause, end, page hide,
 * source change, destroy and optionally every `interval` seconds.
 */
export function trackWatchTime(
  ctx: PlayerstackContext,
  interval: number | undefined,
  report: (data: WatchProgress, src: string) => void,
): () => void {
  const media = ctx.mediaPlayer as HTMLElement &
    Partial<Pick<HTMLMediaElement, "currentTime" | "duration" | "playbackRate">> &
    Partial<Pick<HTMLMediaElement, "paused" | "seeking" | "muted">>;
  const preview = (ctx.config as { preview?: { enabled?: boolean; src?: string } }).preview;
  // The in-player preview (muted autoplay of the main media) is not watching.
  let previewing = !!preview?.enabled && !preview.src && media.hasAttribute("autoplay");

  let sample: { position: number; at: number } | null = null;
  let watched = 0;
  let furthest = 0;
  let duration = 0;
  let reported = { watched: 0, furthest: 0 };
  let firstAttr: string | null = null;
  let sessionAttr: string | null = null;
  let src = ctx.config.src;

  const measure = () => {
    if (previewing && media.muted === false) previewing = false;
    const position = media.currentTime;
    if (previewing || media.seeking || typeof position !== "number" || !Number.isFinite(position)) {
      sample = null;
      return;
    }
    const at = performance.now();
    if (sample) {
      const advance = position - sample.position;
      const possible = ((at - sample.at) / 1000) * (media.playbackRate || 1) + SLACK_SECONDS;
      // A backward or faster-than-clock move is a seek without a `seeking` event.
      if (advance > 0 && advance <= possible) {
        if (sessionAttr === null) {
          sessionAttr = media.getAttribute("src");
          firstAttr ??= sessionAttr;
          // `config.src` goes stale once the host swaps the source.
          src = sessionAttr && sessionAttr !== firstAttr ? sessionAttr : ctx.config.src;
        }
        watched += advance;
        furthest = Math.max(furthest, position);
        if (Number.isFinite(media.duration)) duration = media.duration!;
        else duration = 0;
      }
    }
    sample = { position, at };
  };

  const flush = () => {
    const total = round(watched);
    if (duration <= 0 || total <= reported.watched) return;
    const maxPosition = round(Math.min(furthest, duration));
    report(
      {
        maxPosition,
        previousMaxPosition: reported.furthest,
        watchedSeconds: total,
        watchedDelta: round(total - reported.watched),
        duration: round(duration),
        percent: Math.floor(Math.min(furthest / duration, 1) * 100),
      },
      src,
    );
    reported = { watched: total, furthest: maxPosition };
  };

  const measurePlaying = () => {
    if (!media.paused) measure();
  };

  const stopAndFlush = () => {
    measure();
    sample = null;
    flush();
  };

  const listeners: [EventTarget, string, () => void][] = [
    [media, "playing", measure],
    // Paused timeupdates are scrubbing; the last segment is measured on `pause`.
    [media, "timeupdate", measurePlaying],
    [media, "seeking", () => (sample = null)],
    [media, "seeked", measurePlaying],
    [media, "pause", stopAndFlush],
    [media, "ended", stopAndFlush],
    [
      media,
      "emptied",
      () => {
        sample = null;
        // Reloading the same source continues the same playback.
        if (sessionAttr === null || media.getAttribute("src") === sessionAttr) return;
        flush();
        sessionAttr = null;
        watched = furthest = duration = 0;
        reported = { watched: 0, furthest: 0 };
      },
    ],
    [
      document,
      "visibilitychange",
      () => {
        if (document.visibilityState !== "hidden") return;
        measurePlaying();
        flush();
      },
    ],
    [
      window,
      "pagehide",
      () => {
        measurePlaying();
        flush();
      },
    ],
  ];
  listeners.forEach(([target, name, handler]) => target.addEventListener(name, handler));

  const timer =
    typeof interval === "number" && Number.isFinite(interval) && interval > 0
      ? setInterval(flush, Math.max(interval, MIN_INTERVAL) * 1000)
      : undefined;

  return () => {
    stopAndFlush();
    clearInterval(timer);
    listeners.forEach(([target, name, handler]) => target.removeEventListener(name, handler));
  };
}
