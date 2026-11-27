import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext } from "@playerstack/core";
import { ctaEndPlugin, type CtaEndConfig } from "./index";

type Media = HTMLElement & {
  currentTime: number;
  duration: number;
  paused: boolean;
  muted: boolean;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
};

const contexts: PlayerstackContext[] = [];

afterEach(() => {
  contexts.forEach((ctx) => ctaEndPlugin.destroy?.(ctx));
  contexts.length = 0;
  document.body.replaceChildren();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

async function setup(
  ctaEnd: Partial<CtaEndConfig>,
  config: Record<string, unknown> = {},
  media: Partial<Media> = {},
) {
  const container = document.createElement("div");
  const player = document.createElement("media-player") as unknown as Media;
  Object.assign(player, { currentTime: 0, duration: 100, paused: true, muted: false, ...media });
  player.play = vi.fn(() => {
    player.paused = false;
    player.dispatchEvent(new Event("play"));
  });
  player.pause = vi.fn(() => {
    player.paused = true;
  });
  container.append(player);
  document.body.append(container);
  const ctx = {
    container,
    mediaPlayer: player,
    events: createEventBus(),
    config: {
      src: "https://example.com/v.mp4",
      ctaEnd: { enabled: true, title: "Offer", ...ctaEnd },
      ...config,
    },
  } as unknown as PlayerstackContext;
  contexts.push(ctx);
  const events: [string, unknown][] = [];
  for (const name of ["cta:show", "cta:skip", "cta:click", "cta:replay"])
    ctx.events.on(name, (payload) => events.push([name, payload]));
  await ctaEndPlugin.init(ctx);
  // The extra modes live in their own module, loaded on demand.
  await vi.dynamicImportSettled();
  const overlay = () => container.querySelector<HTMLElement>(".playerstack-cta");
  const at = (time: number, name = "timeupdate") => {
    player.currentTime = time;
    player.dispatchEvent(new Event(name));
  };
  const playing = (time = 0) => {
    player.paused = false;
    at(time, "playing");
  };
  const skip = () => container.querySelector<HTMLButtonElement>(".playerstack-cta-skip");
  return { ctx, player, overlay, at, playing, skip, events };
}

describe("cta-end shown during playback", () => {
  it("pauses and shows the card once playback reaches the configured second", async () => {
    const f = await setup({ at: 30 });
    f.playing();
    f.at(29.9);
    expect(f.overlay()).toBeNull();
    f.at(30.2);
    expect(f.overlay()?.textContent).toContain("Offer");
    expect(f.player.pause).toHaveBeenCalledOnce();
    expect(f.events).toEqual([["cta:show", { at: 30 }]]);
  });

  it("uses a percent of the duration, once the duration is known", async () => {
    const f = await setup({ atPercent: 50 }, {}, { duration: Number.NaN });
    f.at(60);
    expect(f.overlay()).toBeNull();
    f.player.duration = 200;
    f.at(99);
    expect(f.overlay()).toBeNull();
    f.at(100);
    expect(f.overlay()).not.toBeNull();
    expect(f.events).toEqual([["cta:show", { atPercent: 50 }]]);
  });

  it("shows when a seek jumps past the point, and only once per playback", async () => {
    const f = await setup({ at: 30 });
    f.at(80);
    expect(f.overlay()).not.toBeNull();
    f.skip()!.click();
    f.at(10);
    f.at(40);
    expect(f.overlay()).toBeNull();
    expect(f.events.filter(([name]) => name === "cta:show")).toHaveLength(1);
  });

  it("offers the point again after a new source starts loading", async () => {
    const f = await setup({ at: 30 });
    f.at(31);
    f.skip()!.click();
    f.player.dispatchEvent(new Event("emptied"));
    f.at(31);
    expect(f.overlay()).not.toBeNull();
  });

  it("does not show at the end", async () => {
    const f = await setup({ at: 30 });
    f.player.dispatchEvent(new Event("ended"));
    expect(f.overlay()).toBeNull();
  });

  it("resumes playback from the skip button and reports it", async () => {
    const f = await setup({ at: 30, skipLabel: "Pomiń" });
    f.at(30);
    expect(f.skip()?.textContent).toBe("Pomiń");
    f.skip()!.click();
    expect(f.overlay()).toBeNull();
    expect(f.player.play).toHaveBeenCalledOnce();
    expect(f.player.currentTime).toBe(30);
    expect(f.events[f.events.length - 1]).toEqual(["cta:skip", { at: 30 }]);
  });

  it("skips with Escape", async () => {
    const f = await setup({ at: 30 });
    f.at(30);
    expect(f.skip()?.textContent).toBe("Skip");
    f.overlay()!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    expect(f.overlay()).toBeNull();
    expect(f.player.play).toHaveBeenCalledOnce();
  });

  it("keeps the first and last items centred around the added button", async () => {
    const f = await setup({ at: 30, showReplay: true });
    f.at(30);
    const items = [...f.overlay()!.children] as HTMLElement[];
    expect(items[items.length - 1]).toBe(f.skip());
    expect(items.map((item) => item.style.marginBottom === "auto")).toEqual([false, false, true]);
    expect(f.skip()!.style.flexShrink).toBe("0");
  });

  it("holds playback while the card is open", async () => {
    const f = await setup({ at: 30 });
    f.at(30);
    f.player.pause.mockClear();
    // For example the email gate resuming playback after it closes.
    f.player.play();
    expect(f.player.pause).toHaveBeenCalledOnce();
    f.skip()!.click();
    f.player.pause.mockClear();
    f.player.play();
    expect(f.player.pause).not.toHaveBeenCalled();
  });

  it("lets replay restart the video from the card", async () => {
    const f = await setup({ at: 30, showReplay: true });
    f.at(30);
    f.player.pause.mockClear();
    f.ctx.container.querySelector<HTMLButtonElement>(".playerstack-cta-replay")!.click();
    expect(f.overlay()).toBeNull();
    expect(f.player.currentTime).toBe(0);
    expect(f.player.pause).not.toHaveBeenCalled();
  });

  it("ignores the muted autoplay preview of the main video", async () => {
    const f = await setup({ at: 30 }, { preview: { enabled: true } }, { muted: true });
    f.playing();
    f.at(40);
    expect(f.overlay()).toBeNull();
    f.player.muted = false;
    f.at(41);
    expect(f.overlay()).not.toBeNull();
  });

  it("counts muted playback when the preview uses a separate clip", async () => {
    const f = await setup(
      { at: 30 },
      { preview: { enabled: true, src: "p.mp4" } },
      { muted: true },
    );
    f.at(40);
    expect(f.overlay()).not.toBeNull();
  });
});

describe("cta-end shown at the start", () => {
  it("shows when playback starts from the beginning", async () => {
    const f = await setup({ at: "start" });
    expect(f.overlay()).toBeNull();
    f.playing(0.1);
    expect(f.overlay()).not.toBeNull();
    expect(f.player.pause).toHaveBeenCalledOnce();
    expect(f.events).toEqual([["cta:show", { at: "start" }]]);
  });

  it("stays away when playback starts in the middle, also after seeking back", async () => {
    const f = await setup({ at: "start" });
    f.playing(45);
    expect(f.overlay()).toBeNull();
    f.playing(0);
    expect(f.overlay()).toBeNull();
  });

  it("catches playback that started before the module loaded", async () => {
    const f = await setup({ at: "start" }, {}, { paused: false, currentTime: 0.3 });
    expect(f.overlay()).not.toBeNull();
  });
});

describe("cta-end frequency", () => {
  it("shows once per playback at the end when asked to", async () => {
    const f = await setup({ frequency: "playback" });
    f.player.dispatchEvent(new Event("ended"));
    expect(f.overlay()).not.toBeNull();
    expect(f.skip()).toBeNull();
    expect(f.player.pause).not.toHaveBeenCalled();
    expect(f.events).toEqual([["cta:show", { at: "end" }]]);
    f.overlay()!.remove();
    f.player.dispatchEvent(new Event("ended"));
    expect(f.overlay()).toBeNull();
  });

  it("with at 'end' alone reports every end card", async () => {
    const f = await setup({ at: "end" });
    f.player.dispatchEvent(new Event("ended"));
    f.player.dispatchEvent(new Event("ended"));
    expect(f.events.map(([name]) => name)).toEqual(["cta:show", "cta:show"]);
  });

  it("shows once per browser session for the same source", async () => {
    const first = await setup({ at: 30, frequency: "session" });
    first.at(30);
    expect(first.overlay()).not.toBeNull();
    const again = await setup({ at: 30, frequency: "session" });
    again.at(30);
    expect(again.overlay()).toBeNull();
    const other = await setup({ at: 30, frequency: "session" }, { src: "other.mp4" });
    other.at(30);
    expect(other.overlay()).not.toBeNull();
  });

  it("falls back to once per playback when storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const f = await setup({ at: 30, frequency: "session" });
    f.at(30);
    expect(f.overlay()).not.toBeNull();
    f.skip()!.click();
    f.at(31);
    expect(f.overlay()).toBeNull();
  });
});

describe("cta-end teardown", () => {
  it("removes the card and listeners", async () => {
    const f = await setup({ at: 30 });
    f.at(30);
    ctaEndPlugin.destroy?.(f.ctx);
    expect(f.overlay()).toBeNull();
    f.player.pause.mockClear();
    f.player.play();
    f.player.dispatchEvent(new Event("emptied"));
    f.at(30);
    expect(f.overlay()).toBeNull();
    expect(f.player.pause).not.toHaveBeenCalled();
  });

  it("attaches nothing when destroyed before the module arrives", async () => {
    const container = document.createElement("div");
    const player = document.createElement("video");
    const listen = vi.spyOn(player, "addEventListener");
    container.append(player);
    const ctx = {
      container,
      mediaPlayer: player,
      events: createEventBus(),
      config: { src: "v.mp4", ctaEnd: { enabled: true, at: 30 } },
    } as unknown as PlayerstackContext;
    const initialising = ctaEndPlugin.init(ctx);
    ctaEndPlugin.destroy?.(ctx);
    await initialising;
    await vi.dynamicImportSettled();
    expect(listen).not.toHaveBeenCalled();
  });
});
