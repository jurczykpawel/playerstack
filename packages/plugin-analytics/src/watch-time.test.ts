import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsPlugin, type AnalyticsConfig } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

type Media = HTMLElement & {
  currentTime: number;
  duration: number;
  paused: boolean;
  seeking: boolean;
  muted: boolean;
  playbackRate: number;
};

interface Progress {
  maxPosition: number;
  previousMaxPosition: number;
  watchedSeconds: number;
  watchedDelta: number;
  duration: number;
  percent: number;
  [key: string]: unknown;
}

let beacon: ReturnType<typeof vi.fn>;
let active: PlayerstackContext[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  beacon = vi.fn(() => true);
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
});

afterEach(() => {
  active.forEach((ctx) => analyticsPlugin.destroy?.(ctx));
  active = [];
  setVisibility("visible");
  vi.useRealTimers();
});

async function setup(
  analytics: Partial<AnalyticsConfig> = {},
  extra: Partial<PlayerstackConfig> = {},
  attrs: string[] = [],
) {
  const container = document.createElement("div");
  const media = document.createElement("media-player") as unknown as Media;
  Object.assign(media, {
    currentTime: 0,
    duration: 100,
    paused: true,
    seeking: false,
    muted: false,
    playbackRate: 1,
  });
  attrs.forEach((name) => media.setAttribute(name, ""));
  media.setAttribute("src", "https://example.com/v.mp4");
  container.appendChild(media);
  const ctx = {
    events: createEventBus(),
    container,
    mediaPlayer: media,
    config: {
      src: "https://example.com/v.mp4",
      analytics: {
        enabled: true,
        endpoint: "https://example.com/track",
        watchTime: true,
        ...analytics,
      },
      ...extra,
    },
  } as PlayerstackContext;
  active.push(ctx);
  await analyticsPlugin.init(ctx);
  return { ctx, media };
}

const fire = (media: Media, name: string) => media.dispatchEvent(new Event(name));

function start(media: Media) {
  media.paused = false;
  fire(media, "playing");
}

/** Advance the fake clock and the media position together, one timeupdate per 250 ms. */
function watch(media: Media, seconds: number) {
  const step = 0.25 * media.playbackRate;
  for (let i = 0; i < seconds / step; i++) {
    vi.advanceTimersByTime(250);
    media.currentTime += step;
    fire(media, "timeupdate");
  }
}

function pause(media: Media) {
  media.paused = true;
  fire(media, "timeupdate");
  fire(media, "pause");
}

function seek(media: Media, to: number) {
  media.seeking = true;
  media.currentTime = to;
  fire(media, "seeking");
  fire(media, "timeupdate");
  media.seeking = false;
  fire(media, "seeked");
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

const sent = () =>
  beacon.mock.calls
    .map(([, body]) => JSON.parse(body as string) as { event: string; src: string; data: Progress })
    .filter((e) => e.event === "watch_progress");

const last = () => sent()[sent().length - 1]!.data;

describe("analyticsPlugin watch time", () => {
  it("is off by default", async () => {
    const { media } = await setup({ watchTime: undefined });
    start(media);
    watch(media, 10);
    pause(media);
    setVisibility("hidden");
    expect(sent()).toHaveLength(0);
  });

  it("sends furthest point, watched seconds, duration and percent on pause", async () => {
    const { media } = await setup({ customProps: { viewer: "abc" } });
    start(media);
    watch(media, 10);
    expect(sent()).toHaveLength(0);
    pause(media);
    expect(sent()).toHaveLength(1);
    expect(sent()[0]!.src).toBe("https://example.com/v.mp4");
    expect(last()).toEqual({
      maxPosition: 10,
      previousMaxPosition: 0,
      watchedSeconds: 10,
      watchedDelta: 10,
      duration: 100,
      percent: 10,
      viewer: "abc",
    });
  });

  it("counts the last partial segment before pause", async () => {
    const { media } = await setup();
    start(media);
    watch(media, 2);
    vi.advanceTimersByTime(200);
    media.currentTime = 2.2;
    pause(media);
    expect(last().watchedSeconds).toBe(2.2);
  });

  it("reports deltas and the previous furthest point on later flushes", async () => {
    const { media } = await setup();
    start(media);
    watch(media, 10);
    pause(media);
    start(media);
    watch(media, 5);
    pause(media);
    expect(last()).toMatchObject({
      maxPosition: 15,
      previousMaxPosition: 10,
      watchedSeconds: 15,
      watchedDelta: 5,
    });
  });

  it("does not send again when nothing new was watched", async () => {
    const { media } = await setup();
    pause(media);
    start(media);
    watch(media, 3);
    pause(media);
    fire(media, "ended");
    setVisibility("hidden");
    window.dispatchEvent(new Event("pagehide"));
    expect(sent()).toHaveLength(1);
  });

  it("seeking forward adds neither watched seconds nor furthest point by itself", async () => {
    const { media } = await setup();
    start(media);
    watch(media, 10);
    seek(media, 80);
    pause(media);
    expect(last()).toMatchObject({ watchedSeconds: 10, maxPosition: 10 });
    start(media);
    watch(media, 5);
    pause(media);
    expect(last()).toMatchObject({ watchedSeconds: 15, maxPosition: 85 });
  });

  it("ignores a jump without a seeking event (position moved faster than the clock)", async () => {
    const { media } = await setup();
    start(media);
    watch(media, 10);
    vi.advanceTimersByTime(250);
    media.currentTime = 90;
    fire(media, "timeupdate");
    pause(media);
    expect(last()).toMatchObject({ watchedSeconds: 10, maxPosition: 10 });
  });

  it("scrubbing while paused counts nothing", async () => {
    const { media } = await setup();
    start(media);
    watch(media, 4);
    pause(media);
    vi.advanceTimersByTime(60000);
    seek(media, 50);
    media.currentTime = 55;
    fire(media, "timeupdate");
    start(media);
    watch(media, 1);
    pause(media);
    expect(last()).toMatchObject({ watchedSeconds: 5, maxPosition: 56 });
  });

  it("rewatching adds watched seconds but not the furthest point", async () => {
    const { media } = await setup();
    start(media);
    watch(media, 20);
    seek(media, 0);
    watch(media, 15);
    pause(media);
    expect(last()).toMatchObject({ watchedSeconds: 35, maxPosition: 20, percent: 20 });
  });

  it("counts media seconds at higher playback rates", async () => {
    const { media } = await setup();
    media.playbackRate = 2;
    start(media);
    watch(media, 20);
    pause(media);
    expect(last().watchedSeconds).toBe(20);
  });

  it("counts playback with sparse timeupdates (throttled background tab)", async () => {
    const { media } = await setup();
    start(media);
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(2000);
      media.currentTime += 2;
      fire(media, "timeupdate");
    }
    pause(media);
    expect(last().watchedSeconds).toBe(10);
  });

  it("rounds to 0.1 s and the deltas add up to the cumulative total", async () => {
    const { media } = await setup();
    start(media);
    for (const t of [0.33, 0.66, 0.99]) {
      vi.advanceTimersByTime(330);
      media.currentTime = t;
      pause(media);
      start(media);
    }
    const sum = sent().reduce((total, e) => total + e.data.watchedDelta, 0);
    expect(Math.round(sum * 10) / 10).toBe(1);
    expect(last().watchedSeconds).toBe(1);
  });

  it("flushes at the end and never reports more than 100 percent", async () => {
    const { media } = await setup();
    media.duration = 10;
    start(media);
    watch(media, 10.25);
    media.paused = true;
    fire(media, "ended");
    expect(last()).toMatchObject({ maxPosition: 10, duration: 10, percent: 100 });
  });

  it("flushes when the page becomes hidden, and keeps counting background playback", async () => {
    const { media } = await setup();
    start(media);
    watch(media, 8);
    setVisibility("hidden");
    expect(last().watchedSeconds).toBe(8);
    watch(media, 4);
    window.dispatchEvent(new Event("pagehide"));
    expect(last()).toMatchObject({ watchedSeconds: 12, watchedDelta: 4 });
  });

  it("does not flush when the page becomes visible", async () => {
    const { media } = await setup();
    start(media);
    watch(media, 3);
    setVisibility("visible");
    expect(sent()).toHaveLength(0);
  });

  it("sends no periodic events unless watchTimeInterval is set", async () => {
    const { media } = await setup();
    start(media);
    watch(media, 90);
    expect(sent()).toHaveLength(0);
  });

  it("watchTimeInterval sends batches every N seconds, only when there is something new", async () => {
    const { media } = await setup({ watchTimeInterval: 30 });
    start(media);
    watch(media, 65);
    expect(sent().map((e) => e.data.watchedSeconds)).toEqual([29.8, 59.8]);
    pause(media);
    vi.advanceTimersByTime(120000);
    expect(sent()).toHaveLength(3);
  });

  it("raises watchTimeInterval below 5 s to 5 s", async () => {
    const { media } = await setup({ watchTimeInterval: 1 });
    start(media);
    watch(media, 10);
    expect(sent()).toHaveLength(2);
  });

  it("sends nothing while the duration is unknown or infinite (live)", async () => {
    for (const duration of [NaN, Infinity]) {
      const { media } = await setup();
      media.duration = duration;
      start(media);
      watch(media, 5);
      pause(media);
    }
    expect(sent()).toHaveLength(0);
  });

  it("does not count the in-player muted preview until the viewer unmutes", async () => {
    const { media } = await setup({}, { preview: { enabled: true } }, ["autoplay", "loop"]);
    media.muted = true;
    start(media);
    watch(media, 20);
    pause(media);
    expect(sent()).toHaveLength(0);
    media.muted = false;
    seek(media, 0);
    start(media);
    watch(media, 3);
    media.muted = true;
    watch(media, 2);
    pause(media);
    expect(last()).toMatchObject({ watchedSeconds: 5, maxPosition: 5 });
  });

  it("starts over when the source changes, flushing the previous one first", async () => {
    const { media } = await setup();
    start(media);
    watch(media, 10);
    media.setAttribute("src", "https://example.com/next.mp4");
    media.currentTime = 0;
    media.duration = NaN;
    fire(media, "emptied");
    media.duration = 50;
    start(media);
    watch(media, 5);
    pause(media);
    expect(sent().map((e) => [e.src, e.data.watchedSeconds, e.data.duration])).toEqual([
      ["https://example.com/v.mp4", 10, 100],
      ["https://example.com/next.mp4", 5, 50],
    ]);
    expect(last().previousMaxPosition).toBe(0);
  });

  it("labels a source swapped in before anything was watched with its own URL", async () => {
    const { media } = await setup();
    fire(media, "loadstart");
    media.setAttribute("src", "https://example.com/next.mp4");
    fire(media, "emptied");
    fire(media, "loadstart");
    start(media);
    watch(media, 5);
    pause(media);
    expect(sent().map((e) => e.src)).toEqual(["https://example.com/next.mp4"]);
  });

  it("keeps the totals when the same source reloads", async () => {
    const { media } = await setup();
    start(media);
    watch(media, 10);
    pause(media);
    media.currentTime = 0;
    fire(media, "emptied");
    start(media);
    watch(media, 5);
    pause(media);
    expect(last()).toMatchObject({
      watchedSeconds: 15,
      maxPosition: 10,
      previousMaxPosition: 10,
    });
  });

  it("flushes on destroy and stops listening", async () => {
    const { ctx, media } = await setup({ watchTimeInterval: 5 });
    start(media);
    watch(media, 3);
    analyticsPlugin.destroy?.(ctx);
    expect(last().watchedSeconds).toBe(3);
    watch(media, 20);
    pause(media);
    setVisibility("hidden");
    window.dispatchEvent(new Event("pagehide"));
    expect(sent()).toHaveLength(1);
  });
});
