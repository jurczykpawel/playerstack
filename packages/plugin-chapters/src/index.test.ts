import { afterEach, describe, expect, it, vi } from "vitest";
import { chaptersPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const wrapper = document.createElement("div");
  document.body.appendChild(wrapper);
  const container = document.createElement("div");
  container.id = "ps-container";
  wrapper.appendChild(container);
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

function findChaptersList(ctx: PlayerstackContext): HTMLElement | null {
  return (
    ctx.container.parentElement?.querySelector<HTMLElement>(".playerstack-chapters") ??
    ctx.container.querySelector<HTMLElement>(".playerstack-chapters")
  );
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
    expect(findChaptersList(ctx)).toBeNull();
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
    const list = findChaptersList(ctx)!;
    const buttons = list.querySelectorAll(".playerstack-chapter");
    expect(buttons.length).toBe(3);
    expect(buttons[0]?.textContent).toContain("Intro");
    expect(buttons[1]?.textContent).toContain("Body");
  });

  it("mounts the list AFTER <player-stack> as a sibling, NOT inside the container", async () => {
    // The container has overflow:hidden + aspect-ratio:16/9 default styles
    // (set by core in DEFAULT_STYLES). Mounting chapters inside would clip
    // them out of view. Sibling mount keeps the list visible below the player.
    const ctx = makeContext({
      chapters: { points: [{ time: 0, label: "Intro" }] },
    });
    await chaptersPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-chapters")).toBeNull();
    const list = ctx.container.parentElement?.querySelector(".playerstack-chapters");
    expect(list).not.toBeNull();
    // Specifically: list is the next sibling of <player-stack>.
    expect(ctx.container.nextElementSibling).toBe(list);
  });

  describe("containerSelector", () => {
    const points = [{ time: 0, label: "Intro" }];
    const afterPlayer = (ctx: PlayerstackContext) =>
      ctx.container.nextElementSibling?.classList.contains("playerstack-chapters");

    it("mounts the list into the matched layout container", async () => {
      const box = document.createElement("section");
      box.id = "chapter-box";
      document.body.appendChild(box);
      await chaptersPlugin.init(
        makeContext({ chapters: { points, containerSelector: "#chapter-box" } }),
      );
      expect(box.querySelector(".playerstack-chapters")).not.toBeNull();
    });

    for (const [name, html] of [
      ["a button", '<form><button id="target" type="submit"></button></form>'],
      ["a link", '<a id="target" href="https://example.com/logout"></a>'],
      ["an element inside a link", '<a href="https://example.com/x"><span id="target"></span></a>'],
      ["a label", '<label id="target"><input type="checkbox"></label>'],
      ["a summary", '<details><summary id="target"></summary></details>'],
    ] as const) {
      it(`does not mount into ${name}; places the list after the player and warns`, async () => {
        document.body.insertAdjacentHTML("beforeend", html);
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const ctx = makeContext({ chapters: { points, containerSelector: "#target" } });
        await chaptersPlugin.init(ctx);
        expect(document.querySelector("#target .playerstack-chapters")).toBeNull();
        expect(afterPlayer(ctx)).toBe(true);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
      });
    }

    it("falls back to the default place, with a warning, for an invalid selector", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const ctx = makeContext({ chapters: { points, containerSelector: "][" } });
      await expect(chaptersPlugin.init(ctx)).resolves.toBeUndefined();
      expect(afterPlayer(ctx)).toBe(true);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  it("clicking a chapter sets mediaPlayer.currentTime", async () => {
    const ctx = makeContext({
      chapters: { points: [{ time: 30, label: "Body" }] },
    });
    await chaptersPlugin.init(ctx);
    const btn = findChaptersList(ctx)!.querySelector(".playerstack-chapter") as HTMLButtonElement;
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
    const buttons = findChaptersList(ctx)!.querySelectorAll(".playerstack-chapter");
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
    const btn = findChaptersList(ctx)!.querySelector(".playerstack-chapter") as HTMLButtonElement;
    btn.click();
    expect(handler).toHaveBeenCalledWith({ time: 30, label: "Body" });
  });

  it("destroy removes the chapter list and stops listening", async () => {
    const ctx = makeContext({
      chapters: { points: [{ time: 0, label: "A" }] },
    });
    await chaptersPlugin.init(ctx);
    chaptersPlugin.destroy?.(ctx);
    expect(findChaptersList(ctx)).toBeNull();
  });
});
