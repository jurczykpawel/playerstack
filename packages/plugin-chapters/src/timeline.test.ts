import { afterEach, describe, expect, it, vi } from "vitest";
// The events module alone: the core entry point would register the real
// media-chrome elements, while these tests pin the surface the plugin talks to.
import { createEventBus } from "../../core/src/events";
import type { PlayerstackContext } from "@playerstack/core";
import { chaptersPlugin, type ChaptersConfig } from "./index";

const points = [
  { time: 60, label: "Body" },
  { time: 0, label: "Intro" },
  { time: 90, label: "Outro" },
];

// The browser spec covers media-chrome's own rendering.
function makeTimeRange() {
  const timeRange = document.createElement("media-time-range") as HTMLElement & {
    range: HTMLInputElement;
    mediaChaptersCues?: unknown[];
    updateBar: () => void;
  };
  const shadow = timeRange.attachShadow({ mode: "open" });
  const range = document.createElement("input");
  range.type = "range";
  const preview = document.createElement("media-preview-chapter-display") as HTMLElement & {
    mediaPreviewChapter?: string;
  };
  shadow.append(range, preview);
  range.getBoundingClientRect = () => ({ left: 100, width: 600 }) as DOMRect;
  timeRange.range = range;
  timeRange.updateBar = vi.fn();
  return { timeRange, range, preview };
}

const mounted: PlayerstackContext[] = [];

async function mount(chapters: Partial<ChaptersConfig> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const controller = document.createElement("media-controller");
  const media = document.createElement("video") as HTMLVideoElement;
  Object.defineProperty(media, "duration", { value: 120, configurable: true });
  const bar = document.createElement("media-control-bar");
  const parts = makeTimeRange();
  const fullscreen = document.createElement("media-fullscreen-button");
  bar.append(parts.timeRange, fullscreen);
  controller.append(media, bar);
  container.appendChild(controller);
  const ctx = {
    events: createEventBus(),
    container,
    mediaPlayer: media,
    config: { src: "https://example.com/v.mp4", chapters: { points, ...chapters } },
  } as PlayerstackContext;
  const jumps = vi.fn();
  ctx.events.on("chapter:jump", jumps);
  await chaptersPlugin.init(ctx);
  mounted.push(ctx);
  return { ctx, media, bar, fullscreen, jumps, ...parts };
}

const hover = (timeRange: HTMLElement, detail: number | null) =>
  timeRange.dispatchEvent(
    new CustomEvent("mediapreviewrequest", { bubbles: true, composed: true, detail }),
  );

function click(timeRange: HTMLElement, x: number, downAt = x) {
  timeRange.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: downAt }));
  timeRange.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, detail: 1 }));
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  for (const ctx of mounted.splice(0)) chaptersPlugin.destroy?.(ctx);
  document.body.innerHTML = "";
});

describe("chapter markers", () => {
  it("leaves the progress bar alone unless enabled", async () => {
    const { timeRange, preview, jumps, media } = await mount();
    expect(timeRange.mediaChaptersCues).toBeUndefined();
    expect(timeRange.querySelector('[slot="current"]')).toBeNull();
    hover(timeRange, 70);
    expect(preview.mediaPreviewChapter).toBeUndefined();
    click(timeRange, 400);
    expect(media.currentTime).toBe(0);
    expect(jumps).not.toHaveBeenCalled();
  });

  it("gives the time range one segment per chapter, in time order", async () => {
    const { timeRange } = await mount({ markers: true });
    expect(timeRange.mediaChaptersCues).toEqual([
      { text: "Intro", startTime: 0, endTime: 60 },
      { text: "Body", startTime: 60, endTime: 90 },
      { text: "Outro", startTime: 90, endTime: Infinity },
    ]);
  });

  it("ignores points without a usable time", async () => {
    const { timeRange } = await mount({
      markers: true,
      points: [
        { time: -5, label: "Before" },
        { time: Number.NaN, label: "Unknown" },
        { time: 30, label: "Body" },
      ],
    });
    expect(timeRange.mediaChaptersCues).toEqual([
      { text: "Body", startTime: 30, endTime: Infinity },
    ]);
  });

  it("shows the chapter title for the hovered time", async () => {
    const { timeRange, preview } = await mount({
      markers: true,
      points: [{ time: 30, label: "Body" }],
    });
    hover(timeRange, 45);
    expect(preview.mediaPreviewChapter).toBe("Body");
    hover(timeRange, 10);
    expect(preview.mediaPreviewChapter).toBe("");
  });

  it("shows the title at the playhead while the seek slider has keyboard focus", async () => {
    const { timeRange, range, media } = await mount({ markers: true });
    const title = timeRange.querySelector<HTMLElement>('[slot="current"]')!;
    expect(title.hidden).toBe(true);
    expect(title.getAttribute("aria-hidden")).toBe("true");
    expect(title.style.pointerEvents).toBe("none");
    range.matches = (selector: string) => selector === ":focus-visible";
    range.dispatchEvent(new FocusEvent("focus"));
    timeRange.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(title.hidden).toBe(false);
    expect(title.textContent).toBe("Intro");
    expect(timeRange.updateBar).toHaveBeenCalled();
    media.currentTime = 65;
    media.dispatchEvent(new Event("timeupdate"));
    expect(title.textContent).toBe("Body");
    timeRange.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(title.hidden).toBe(true);
  });

  it("keeps the title hidden for pointer focus", async () => {
    const { timeRange, range } = await mount({ markers: true });
    range.matches = () => false;
    timeRange.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(timeRange.querySelector<HTMLElement>('[slot="current"]')!.hidden).toBe(true);
  });

  it("adds the chapter title to the slider value text", async () => {
    const { range, media } = await mount({ markers: true });
    range.setAttribute("aria-valuetext", "5 seconds of 2 minutes");
    await flush();
    expect(range.getAttribute("aria-valuetext")).toBe("5 seconds of 2 minutes, Intro");
    media.currentTime = 61;
    range.setAttribute("aria-valuetext", "1 minute, 1 second of 2 minutes");
    await flush();
    expect(range.getAttribute("aria-valuetext")).toBe("1 minute, 1 second of 2 minutes, Body");
  });

  it("jumps to the chapter start when a marker is clicked", async () => {
    const { timeRange, media, jumps } = await mount({ markers: true });
    // 60 s of 120 s on a track from x=100 to x=700 sits at x=400.
    click(timeRange, 405);
    expect(media.currentTime).toBe(60);
    expect(jumps).toHaveBeenCalledWith({ time: 60, label: "Body" });
  });

  it("leaves clicks away from a marker and drags to the progress bar", async () => {
    const { timeRange, media, jumps } = await mount({ markers: true });
    media.currentTime = 12;
    click(timeRange, 420);
    click(timeRange, 402, 200);
    expect(media.currentTime).toBe(12);
    expect(jumps).not.toHaveBeenCalled();
  });

  it("destroy restores the progress bar", async () => {
    const { ctx, timeRange, range, preview, media, jumps } = await mount({ markers: true });
    range.setAttribute("aria-valuetext", "5 seconds of 2 minutes");
    await flush();
    chaptersPlugin.destroy?.(ctx);
    expect(timeRange.mediaChaptersCues).toEqual([]);
    expect(timeRange.querySelector('[slot="current"]')).toBeNull();
    expect(range.getAttribute("aria-valuetext")).toBe("5 seconds of 2 minutes");
    preview.mediaPreviewChapter = undefined;
    hover(timeRange, 70);
    click(timeRange, 400);
    expect(preview.mediaPreviewChapter).toBeUndefined();
    expect(media.currentTime).toBe(0);
    expect(jumps).not.toHaveBeenCalled();
  });
});

describe("chapter menu", () => {
  const toggle = (bar: HTMLElement) =>
    bar.querySelector<HTMLButtonElement>(".playerstack-chapters-toggle");
  const panel = (ctx: PlayerstackContext) =>
    ctx.container.querySelector<HTMLElement>(".playerstack-chapters-menu");
  const items = (ctx: PlayerstackContext) => [...panel(ctx)!.querySelectorAll("button")];

  it("is not added unless enabled", async () => {
    const { ctx, bar } = await mount();
    expect(toggle(bar)).toBeNull();
    expect(panel(ctx)).toBeNull();
  });

  it("adds a named, closed toggle before the fullscreen button", async () => {
    const { ctx, bar, fullscreen } = await mount({ menu: true });
    const button = toggle(bar)!;
    expect(button.nextElementSibling).toBe(fullscreen);
    expect(button.getAttribute("aria-label")).toBe("Chapters");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    // Keeps Space and Enter from also toggling playback.
    expect(button.getAttribute("keysused")).toBe("Space Enter");
    expect(panel(ctx)!.hidden).toBe(true);
  });

  it("keeps Space on the toggle away from the player, which would cancel the press", async () => {
    const { ctx, bar } = await mount({ menu: true });
    const reached = vi.fn();
    ctx.container.querySelector("media-controller")!.addEventListener("keydown", reached);
    toggle(bar)!.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(reached).not.toHaveBeenCalled();
    toggle(bar)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(reached).toHaveBeenCalledOnce();
  });

  it("keeps the menu inside media-controller, the element that goes fullscreen", async () => {
    const { ctx } = await mount({ menu: true });
    expect(panel(ctx)!.parentElement!.localName).toBe("media-controller");
    expect(panel(ctx)!.hasAttribute("noautohide")).toBe(true);
  });

  it("takes its name from menuLabel", async () => {
    const { ctx, bar } = await mount({ menu: true, menuLabel: "Rozdziały" });
    expect(toggle(bar)!.getAttribute("aria-label")).toBe("Rozdziały");
    expect(panel(ctx)!.getAttribute("aria-label")).toBe("Rozdziały");
  });

  it("opens with the current chapter focused and marked", async () => {
    const { ctx, bar, media } = await mount({ menu: true });
    media.currentTime = 70;
    toggle(bar)!.click();
    expect(panel(ctx)!.hidden).toBe(false);
    expect(toggle(bar)!.getAttribute("aria-expanded")).toBe("true");
    expect(items(ctx).map((b) => b.textContent)).toEqual([
      "0:00  Intro",
      "1:00  Body",
      "1:30  Outro",
    ]);
    expect(items(ctx).map((b) => b.getAttribute("aria-current"))).toEqual([null, "true", null]);
    expect(document.activeElement).toBe(items(ctx)[1]);
  });

  it("jumps, closes and returns focus to the toggle on selection", async () => {
    const { ctx, bar, media, jumps } = await mount({ menu: true });
    toggle(bar)!.click();
    items(ctx)[2]!.click();
    expect(media.currentTime).toBe(90);
    expect(jumps).toHaveBeenCalledWith({ time: 90, label: "Outro" });
    expect(panel(ctx)!.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle(bar));
  });

  it("closes on Escape, on a second toggle click and on an outside press", async () => {
    const { ctx, bar } = await mount({ menu: true });
    toggle(bar)!.click();
    items(ctx)[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(panel(ctx)!.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle(bar));
    toggle(bar)!.click();
    toggle(bar)!.click();
    expect(panel(ctx)!.hidden).toBe(true);
    toggle(bar)!.click();
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(panel(ctx)!.hidden).toBe(true);
    expect(toggle(bar)!.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when focus moves elsewhere", async () => {
    const { ctx, bar } = await mount({ menu: true });
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    toggle(bar)!.click();
    items(ctx)[0]!.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, relatedTarget: outside }),
    );
    expect(panel(ctx)!.hidden).toBe(true);
  });

  it("stays open when a press moves focus to an element around the menu", async () => {
    // Safari does not focus a pressed button; focus lands on a focusable ancestor.
    const { ctx, bar } = await mount({ menu: true });
    toggle(bar)!.click();
    items(ctx)[0]!.dispatchEvent(
      new FocusEvent("focusout", {
        bubbles: true,
        relatedTarget: panel(ctx)!.parentElement,
      }),
    );
    expect(panel(ctx)!.hidden).toBe(false);
  });

  it("destroy removes the toggle and the panel", async () => {
    const { ctx, bar } = await mount({ menu: true });
    chaptersPlugin.destroy?.(ctx);
    expect(toggle(bar)).toBeNull();
    expect(panel(ctx)).toBeNull();
  });
});
