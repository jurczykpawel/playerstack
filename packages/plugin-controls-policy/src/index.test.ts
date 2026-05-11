import { afterEach, describe, expect, it } from "vitest";
import { controlsPolicyPlugin } from "./index";
import { createEventBus } from "@playerstack/core";
import type { PlayerstackContext, PlayerstackConfig } from "@playerstack/core";

function makeContext(extra: Partial<PlayerstackConfig> = {}): PlayerstackContext {
  const container = document.createElement("div");
  const mediaPlayer = document.createElement("media-player");
  container.appendChild(mediaPlayer);
  return {
    events: createEventBus(),
    container,
    mediaPlayer,
    config: { src: "https://example.com/v.mp4", ...extra },
  } as PlayerstackContext;
}

afterEach(() => {
  document
    .querySelectorAll("style[data-playerstack='controls-policy']")
    .forEach((el) => el.remove());
});

describe("controlsPolicyPlugin", () => {
  it("has a stable name", () => {
    expect(controlsPolicyPlugin.name).toBe("controls-policy");
  });

  it("does nothing when no controls config is present", async () => {
    const ctx = makeContext();
    await controlsPolicyPlugin.init(ctx);
    expect(ctx.container.style.cssText).toBe("");
    expect(ctx.mediaPlayer.style.cssText).toBe("");
    expect(document.querySelector("style[data-playerstack='controls-policy']")).toBeNull();
  });

  it("sets --media-brand, --video-brand, --ps-accent inline on the container when accent is configured", async () => {
    const ctx = makeContext({ controls: { accent: "#008aff" } });
    await controlsPolicyPlugin.init(ctx);
    // Vars must live on <player-stack> (the container) so they cascade to
    // <media-controller> and <media-control-bar>, which are siblings of the
    // inner <video> element — putting them on mediaPlayer (the inner element)
    // would NOT cascade to the control bar.
    expect(ctx.container.style.getPropertyValue("--media-brand")).toBe("#008aff");
    expect(ctx.container.style.getPropertyValue("--video-brand")).toBe("#008aff");
    expect(ctx.container.style.getPropertyValue("--ps-accent")).toBe("#008aff");
    // mediaPlayer (the inner <video>) must NOT carry these vars.
    expect(ctx.mediaPlayer.style.getPropertyValue("--media-brand")).toBe("");
  });

  it("does not inject a style block into mediaPlayer (selectors won't match light DOM)", async () => {
    const ctx = makeContext({ controls: { accent: "#008aff" } });
    await controlsPolicyPlugin.init(ctx);
    expect(ctx.mediaPlayer.querySelector("style[data-playerstack='controls-policy']")).toBeNull();
  });

  it("injects a scoped hide-rules style block into document.head when show whitelist is set", async () => {
    const ctx = makeContext({ controls: { show: ["play", "progress"] } });
    await controlsPolicyPlugin.init(ctx);
    const style = document.querySelector("style[data-playerstack='controls-policy']");
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain("media-volume-range");
    expect(style?.textContent).toContain("display: none");
    expect(style?.textContent).toMatch(/player-stack:has\(\[data-ps-id="ps-\d+"\]\)/);
  });

  it("tags mediaPlayer with data-ps-id so the scoped selector matches", async () => {
    const ctx = makeContext({ controls: { show: ["play"] } });
    await controlsPolicyPlugin.init(ctx);
    const id = ctx.mediaPlayer.getAttribute("data-ps-id");
    expect(id).toMatch(/^ps-\d+$/);
  });

  it("destroy removes inline vars, the document style block, and the data-ps-id", async () => {
    const ctx = makeContext({
      controls: { accent: "#008aff", show: ["play"] },
    });
    await controlsPolicyPlugin.init(ctx);
    controlsPolicyPlugin.destroy?.(ctx);
    expect(ctx.container.style.getPropertyValue("--media-brand")).toBe("");
    expect(ctx.container.style.getPropertyValue("--ps-accent")).toBe("");
    expect(ctx.mediaPlayer.hasAttribute("data-ps-id")).toBe(false);
    expect(document.querySelector("style[data-playerstack='controls-policy']")).toBeNull();
  });

  it("isolates state between two contexts (multi-instance safe)", async () => {
    const a = makeContext({ controls: { accent: "#aaaaaa", show: ["play"] } });
    const b = makeContext({ controls: { accent: "#bbbbbb", show: ["progress"] } });

    await controlsPolicyPlugin.init(a);
    await controlsPolicyPlugin.init(b);

    expect(a.container.style.getPropertyValue("--media-brand")).toBe("#aaaaaa");
    expect(b.container.style.getPropertyValue("--media-brand")).toBe("#bbbbbb");
    expect(a.mediaPlayer.getAttribute("data-ps-id")).not.toBe(
      b.mediaPlayer.getAttribute("data-ps-id"),
    );
    expect(document.querySelectorAll("style[data-playerstack='controls-policy']").length).toBe(2);

    controlsPolicyPlugin.destroy?.(a);
    expect(a.container.style.getPropertyValue("--media-brand")).toBe("");
    expect(b.container.style.getPropertyValue("--media-brand")).toBe("#bbbbbb");
    expect(document.querySelectorAll("style[data-playerstack='controls-policy']").length).toBe(1);
  });
});
