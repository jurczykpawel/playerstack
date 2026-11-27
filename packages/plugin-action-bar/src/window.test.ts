import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext } from "@playerstack/core";
import { actionBarPlugin, type ActionBarConfig } from "./index";

type Media = HTMLElement & { currentTime: number; duration: number };

afterEach(() => {
  document.body.replaceChildren();
});

async function setup(actionBar: Partial<ActionBarConfig>) {
  const container = document.createElement("div");
  const controller = document.createElement("media-controller");
  controller.tabIndex = 0;
  const player = document.createElement("media-player") as unknown as Media;
  Object.assign(player, { currentTime: 0, duration: 100 });
  controller.append(player);
  container.append(controller);
  document.body.append(container);
  const ctx = {
    container,
    mediaPlayer: player,
    events: createEventBus(),
    config: {
      src: "v.mp4",
      actionBar: { enabled: true, title: "Offer", ...actionBar },
    },
  } as unknown as PlayerstackContext;
  const shown = vi.fn();
  ctx.events.on("action-bar:show", shown);
  const listen = vi.spyOn(player, "addEventListener");
  const unlisten = vi.spyOn(player, "removeEventListener");
  await actionBarPlugin.init(ctx);
  const bar = () => container.querySelector<HTMLElement>(".playerstack-action-bar");
  const at = (time: number) => {
    player.currentTime = time;
    player.dispatchEvent(new Event("timeupdate"));
  };
  return { ctx, controller, player, bar, at, shown, listen, unlisten };
}

describe("action-bar window", () => {
  it("is visible only from showAt until hideAt, in both directions", async () => {
    const f = await setup({ showAt: 20, hideAt: 40 });
    f.at(19);
    expect(f.bar()).toBeNull();
    f.at(20);
    expect(f.bar()).not.toBeNull();
    f.at(40);
    expect(f.bar()).toBeNull();
    f.at(30);
    expect(f.bar()).not.toBeNull();
    f.at(5);
    expect(f.bar()).toBeNull();
    expect(f.shown).toHaveBeenCalledOnce();
  });

  it("shows from the start and leaves at hideAt", async () => {
    const f = await setup({ hideAt: 10 });
    expect(f.bar()).not.toBeNull();
    f.at(10);
    expect(f.bar()).toBeNull();
  });

  it("stays away when playback resumes after the window", async () => {
    const f = await setup({ showAt: 20, hideAt: 40 });
    f.at(70);
    expect(f.bar()).toBeNull();
    expect(f.shown).not.toHaveBeenCalled();
  });

  it("accepts percentages for both ends", async () => {
    const f = await setup({ atPercent: 25, hideAtPercent: 50 });
    f.player.duration = 200;
    f.at(49);
    expect(f.bar()).toBeNull();
    f.at(50);
    expect(f.bar()).not.toBeNull();
    f.at(100);
    expect(f.bar()).toBeNull();
  });

  it("stays dismissed and stops listening", async () => {
    const f = await setup({ hideAt: 40 });
    f.bar()!.querySelector<HTMLButtonElement>(".playerstack-action-bar-close")!.click();
    f.at(50);
    f.at(5);
    expect(f.bar()).toBeNull();
    expect(f.unlisten).toHaveBeenCalledWith("timeupdate", f.listen.mock.calls[0]![1]);
  });

  it("hands focus to the player when it leaves with focus inside", async () => {
    const f = await setup({ hideAt: 10 });
    f.bar()!.querySelector<HTMLButtonElement>(".playerstack-action-bar-close")!.focus();
    f.at(10);
    expect(document.activeElement).toBe(f.controller);
  });

  it("without a hide point stays once shown, as before", async () => {
    const f = await setup({ showAt: 20 });
    f.at(25);
    f.at(5);
    expect(f.bar()).not.toBeNull();
    expect(f.shown).toHaveBeenCalledOnce();
  });

  it("reports an immediate bar too", async () => {
    const f = await setup({});
    expect(f.shown).toHaveBeenCalledOnce();
  });

  it("removes its listener and node on destroy", async () => {
    const f = await setup({ hideAt: 40 });
    actionBarPlugin.destroy?.(f.ctx);
    f.at(5);
    expect(f.bar()).toBeNull();
  });
});

describe("action-bar badge", () => {
  it("sits in the top right corner at its own width", async () => {
    const f = await setup({ variant: "badge" });
    const { style, classList } = f.bar()!;
    expect(classList.contains("playerstack-action-bar-badge")).toBe(true);
    expect(style.top).toBe("8px");
    expect(style.right).toBe("8px");
    expect(style.left).toBe("");
    expect(style.maxWidth).toBe("calc(100% - 16px)");
  });

  it.each([
    ["top-left", "top", "left"],
    ["bottom-left", "bottom", "left"],
    ["bottom-right", "bottom", "right"],
    ["bottom", "bottom", "right"],
  ] as const)("honours position %s", async (position, vertical, side) => {
    const f = await setup({ variant: "badge", position });
    const style = f.bar()!.style;
    expect(style.getPropertyValue(vertical)).toBe(vertical === "top" ? "8px" : "60px");
    expect(style.getPropertyValue(side)).toBe("8px");
    expect(style.getPropertyValue(side === "left" ? "right" : "left")).toBe("");
  });

  it("keeps the full-width bar for corner names without the badge variant", async () => {
    const f = await setup({ position: "top-left" });
    const style = f.bar()!.style;
    expect([style.top, style.left, style.right]).toEqual(["8px", "8px", "8px"]);
  });
});
