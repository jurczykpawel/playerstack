import { afterEach, describe, expect, it, vi } from "vitest";
import { actionBarPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const mediaPlayer = document.createElement("media-player") as unknown as HTMLElement & {
    currentTime: number;
    duration: number;
  };
  mediaPlayer.currentTime = 0;
  mediaPlayer.duration = 100;
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

describe("actionBarPlugin", () => {
  it("has a stable name", () => {
    expect(actionBarPlugin.name).toBe("action-bar");
  });

  it("does nothing when not enabled", async () => {
    const ctx = makeContext();
    await actionBarPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-action-bar")).toBeNull();
  });

  it("with showAt='start': renders banner immediately", async () => {
    const ctx = makeContext({
      actionBar: { enabled: true, showAt: "start", title: "Heads up" },
    });
    await actionBarPlugin.init(ctx);
    const bar = ctx.container.querySelector(".playerstack-action-bar");
    expect(bar).not.toBeNull();
    expect(bar?.textContent).toContain("Heads up");
  });

  it("with showAt=number: shows when currentTime crosses threshold (seconds)", async () => {
    const ctx = makeContext({
      actionBar: { enabled: true, showAt: 30, title: "Hello" },
    });
    await actionBarPlugin.init(ctx);
    expect(ctx.container.querySelector(".playerstack-action-bar")).toBeNull();
    const player = ctx.mediaPlayer as HTMLElement & { currentTime: number };
    player.currentTime = 35;
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    expect(ctx.container.querySelector(".playerstack-action-bar")).not.toBeNull();
  });

  it("renders a button when configured", async () => {
    const ctx = makeContext({
      actionBar: {
        enabled: true,
        showAt: "start",
        title: "Now playing",
        button: { label: "Open guide", url: "https://example.com/guide" },
      },
    });
    await actionBarPlugin.init(ctx);
    const link = ctx.container.querySelector(
      "a.playerstack-action-bar-button",
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.href).toContain("https://example.com/guide");
  });

  it("emits action-bar:click when button is clicked", async () => {
    const ctx = makeContext({
      actionBar: {
        enabled: true,
        showAt: "start",
        button: { label: "Go", url: "https://example.com" },
      },
    });
    const handler = vi.fn();
    ctx.events.on("action-bar:click", handler);
    await actionBarPlugin.init(ctx);
    const link = ctx.container.querySelector(
      "a.playerstack-action-bar-button",
    ) as HTMLAnchorElement;
    link.click();
    expect(handler).toHaveBeenCalled();
  });

  it("dismiss button removes the bar and emits action-bar:dismiss", async () => {
    const ctx = makeContext({
      actionBar: { enabled: true, showAt: "start", title: "Hi" },
    });
    const handler = vi.fn();
    ctx.events.on("action-bar:dismiss", handler);
    await actionBarPlugin.init(ctx);
    const close = ctx.container.querySelector(".playerstack-action-bar-close") as HTMLButtonElement;
    close.click();
    expect(ctx.container.querySelector(".playerstack-action-bar")).toBeNull();
    expect(handler).toHaveBeenCalled();
  });

  it("destroy removes the bar", async () => {
    const ctx = makeContext({
      actionBar: { enabled: true, showAt: "start", title: "Hi" },
    });
    await actionBarPlugin.init(ctx);
    actionBarPlugin.destroy?.(ctx);
    expect(ctx.container.querySelector(".playerstack-action-bar")).toBeNull();
  });

  it("actionBar.html is rendered through the core sanitizer (non-whitelisted tags removed)", async () => {
    const ctx = makeContext({
      actionBar: {
        enabled: true,
        showAt: "start",
        html: '<em>ok</em><script>x()</script><img onerror="x()" src=x>',
      },
    });
    await actionBarPlugin.init(ctx);
    const bar = ctx.container.querySelector(".playerstack-action-bar");
    const html = bar?.innerHTML ?? "";
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror/i);
    expect(html).toContain("<em>ok</em>");
  });

  it("does not render the CTA link when button url is not http(s)", async () => {
    const ctx = makeContext({
      actionBar: {
        enabled: true,
        showAt: "start",
        button: { label: "x", url: "javascript:x" },
      },
    });
    await actionBarPlugin.init(ctx);
    expect(ctx.container.querySelector("a.playerstack-action-bar-button")).toBeNull();
  });
});
