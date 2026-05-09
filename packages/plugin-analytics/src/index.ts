import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export interface AnalyticsConfig {
  enabled?: boolean;
  /** "beacon" sends to endpoint via sendBeacon; "gtag" calls window.gtag. Default: "beacon" if endpoint is set. */
  provider?: "beacon" | "gtag";
  /** Required when provider="beacon". */
  endpoint?: string;
  /** Extra properties merged into every event payload. */
  customProps?: Record<string, unknown>;
  /** Subset of bus events to forward. Default: all known events. */
  forwardBusEvents?: string[];
  /** Subset of native media events. Default: ["play", "pause", "ended"]. */
  forwardMediaEvents?: string[];
}

interface State {
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, State>();

const DEFAULT_BUS_EVENTS = ["thumb:click", "cta:click", "cta:replay", "chapter:jump"];
const DEFAULT_MEDIA_EVENTS = ["play", "pause", "ended"];

export const analyticsPlugin: PlayerstackPlugin = {
  name: "analytics",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { analytics?: AnalyticsConfig }).analytics;
    if (!cfg?.enabled) return;

    const provider = cfg.provider ?? (cfg.endpoint ? "beacon" : "gtag");
    const customProps = cfg.customProps ?? {};

    const send = (event: string, data: Record<string, unknown> = {}) => {
      const payload = { ...data, ...customProps };
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

    states.set(ctx, {
      cleanup: () => {
        busUnsubscribers.forEach((u) => u());
        mediaListeners.forEach(({ name, handler }) =>
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
