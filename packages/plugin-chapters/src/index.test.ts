import { afterEach, describe, expect, it, vi } from "vitest";
import { chaptersPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const mediaPlayer = document.createElement("media-player") as HTMLElement & {
    currentTime: number;
  };
  mediaPlayer.currentTime = 0;
  container.appendChild(mediaPlayer);
  return {
    events: createEventBus(),
    container,
    mediaPlayer,
    config: { src: "https://example.com/v.mp4", ...extra },
  } as PlayerstackContext;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("chaptersPlugin", () => {
  it("has a stable name", () => {
    expect(chaptersPlugin.name).toBe("chapters");
  });

  it("does nothing when chapters config is missing", async () => {
    const ctx = makeContext();
    await chaptersPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-chapters")).toBeNull();
  });

  it("renders one button per chapter point", async () => {
    const ctx = makeContext({
      chapters: {
        points: [
          { time: 0, label: "Intro" },
          { time: 30, label: "Body" },
          { time: 90, label: "Outro" },
        ],
      },
    });
    await chaptersPlugin.init(ctx);
    const buttons = ctx.container.querySelectorAll(".playerstack-chapter");
    expect(buttons.length).toBe(3);
    expect(buttons[0]?.textContent).toContain("Intro");
    expect(buttons[1]?.textContent).toContain("Body");
  });

  it("clicking a chapter sets mediaPlayer.currentTime", async () => {
    const ctx = makeContext({
      chapters: { points: [{ time: 30, label: "Body" }] },
    });
    await chaptersPlugin.init(ctx);
    const btn = ctx.container.querySelector(".playerstack-chapter") as HTMLButtonElement;
    btn.click();
    expect((ctx.mediaPlayer as unknown as { currentTime: number }).currentTime).toBe(30);
  });

  it("highlights the chapter active for the current time", async () => {
    const ctx = makeContext({
      chapters: {
        points: [
          { time: 0, label: "A" },
          { time: 30, label: "B" },
          { time: 60, label: "C" },
        ],
      },
    });
    await chaptersPlugin.init(ctx);
    const player = ctx.mediaPlayer as HTMLElement & { currentTime: number };
    player.currentTime = 35;
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    const buttons = ctx.container.querySelectorAll(".playerstack-chapter");
    expect(buttons[0]?.classList.contains("active")).toBe(false);
    expect(buttons[1]?.classList.contains("active")).toBe(true);
    expect(buttons[2]?.classList.contains("active")).toBe(false);
  });

  it("emits chapter:jump on click", async () => {
    const ctx = makeContext({
      chapters: { points: [{ time: 30, label: "Body" }] },
    });
    const handler = vi.fn();
    ctx.events.on("chapter:jump", handler);
    await chaptersPlugin.init(ctx);
    const btn = ctx.container.querySelector(".playerstack-chapter") as HTMLButtonElement;
    btn.click();
    expect(handler).toHaveBeenCalledWith({ time: 30, label: "Body" });
  });

  it("destroy removes the chapter list and stops listening", async () => {
    const ctx = makeContext({
      chapters: { points: [{ time: 0, label: "A" }] },
    });
    await chaptersPlugin.init(ctx);
    chaptersPlugin.destroy?.(ctx);
    expect(ctx.container.querySelector(".playerstack-chapters")).toBeNull();
  });
});
