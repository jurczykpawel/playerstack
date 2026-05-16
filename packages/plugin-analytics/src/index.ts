import { isSafeHttpUrl, type PlayerstackPlugin, type PlayerstackContext } from "@playerstack/core";

export interface AnalyticsConfig {
  enabled?: boolean;
  /** "beacon" sends to endpoint via sendBeacon; "gtag" calls window.gtag; "console" logs to console. Default: "beacon" if endpoint is set. */
  provider?: "beacon" | "gtag" | "console";
  /** Required when provider="beacon". */
  endpoint?: string;
  /** Also log every event to console, regardless of provider. Useful for debugging. */
  debug?: boolean;
  /** Extra properties merged into every event payload. */
  customProps?: Record<string, unknown>;
  /** Subset of bus events to forward. Default: all known events. */
  forwardBusEvents?: string[];
  /** Subset of native media events. Default: ["play", "pause", "ended"]. */
  forwardMediaEvents?: string[];
  /**
   * Emit a `progress` event when the viewer crosses given percent thresholds.
   * Each threshold fires at most once per playback session (reset on new src
   * load). `true` (default when enabled) uses [25, 50, 75, 100]; `false`
   * disables; an array overrides the thresholds (values 1-100).
   */
  quartiles?: boolean | number[];
}

interface State {
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, State>();

const DEFAULT_BUS_EVENTS = ["thumb:click", "cta:click", "cta:replay", "chapter:jump"];
const DEFAULT_MEDIA_EVENTS = ["play", "pause", "ended"];
const DEFAULT_QUARTILES = [25, 50, 75, 100];

function resolveQuartiles(q: AnalyticsConfig["quartiles"]): number[] | null {
  if (q === false) return null;
  const raw = Array.isArray(q) ? q : DEFAULT_QUARTILES;
  const cleaned = Array.from(
    new Set(
      raw.filter(
        (n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 100,
      ),
    ),
  ).sort((a, b) => a - b);
  return cleaned.length > 0 ? cleaned : null;
}

export const analyticsPlugin: PlayerstackPlugin = {
  name: "analytics",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { analytics?: AnalyticsConfig }).analytics;
    if (!cfg?.enabled) return;

    const provider = cfg.provider ?? (cfg.endpoint ? "beacon" : "gtag");
    const customProps = cfg.customProps ?? {};

    if (provider === "beacon" && !isSafeHttpUrl(cfg.endpoint)) {
      console.warn(
        "[playerstack:analytics] endpoint must be an http(s) URL when provider is 'beacon'. Plugin disabled.",
      );
      return;
    }

    const send = (event: string, data: Record<string, unknown> = {}) => {
      const payload = { ...data, ...customProps };
      if (cfg.debug || provider === "console") {
        console.log("[playerstack:analytics]", event, {
          src: ctx.config.src,
          data: payload,
          ts: Date.now(),
        });
      }
      if (provider === "console") return;
      if (provider === "gtag") {
        const gtag = (globalThis as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
        gtag?.("event", event, payload);
        return;
      }
      if (cfg.endpoint && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        navigator.sendBeacon(
          cfg.endpoint,
          JSON.stringify({ event, src: ctx.config.src, data: payload, ts: Date.now() }),
        );
      }
    };

    const busEvents = cfg.forwardBusEvents ?? DEFAULT_BUS_EVENTS;
    const busUnsubscribers = busEvents.map((name) =>
      ctx.events.on(name as never, (payload: unknown) => {
        const data =
          payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
        send(name, data);
      }),
    );

    const mediaEvents = cfg.forwardMediaEvents ?? DEFAULT_MEDIA_EVENTS;
    const mediaListeners = mediaEvents.map((name) => {
      const handler = () => send(name);
      ctx.mediaPlayer.addEventListener(name, handler);
      return { name, handler };
    });

    const quartileThresholds = resolveQuartiles(cfg.quartiles);
    let progressHandlers: { name: string; handler: EventListener }[] = [];
    if (quartileThresholds) {
      const reached = new Set<number>();
      const onTimeUpdate = () => {
        const media = ctx.mediaPlayer as unknown as { currentTime?: number; duration?: number };
        const duration = media.duration;
        const currentTime = media.currentTime;
        if (
          typeof duration !== "number" ||
          !Number.isFinite(duration) ||
          duration <= 0 ||
          typeof currentTime !== "number" ||
          !Number.isFinite(currentTime)
        ) {
          return;
        }
        const percent = (currentTime / duration) * 100;
        for (const threshold of quartileThresholds) {
          if (percent >= threshold && !reached.has(threshold)) {
            reached.add(threshold);
            send("progress", { percent: threshold });
          }
        }
      };
      const onReset = () => reached.clear();
      progressHandlers = [
        { name: "timeupdate", handler: onTimeUpdate },
        { name: "loadedmetadata", handler: onReset },
        { name: "emptied", handler: onReset },
      ];
      progressHandlers.forEach(({ name, handler }) =>
        ctx.mediaPlayer.addEventListener(name, handler),
      );
    }

    states.set(ctx, {
      cleanup: () => {
        busUnsubscribers.forEach((u) => u());
        mediaListeners.forEach(({ name, handler }) =>
          ctx.mediaPlayer.removeEventListener(name, handler),
        );
        progressHandlers.forEach(({ name, handler }) =>
          ctx.mediaPlayer.removeEventListener(name, handler),
        );
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};
