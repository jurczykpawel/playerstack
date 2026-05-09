import { describe, expect, it } from "vitest";
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

describe("controlsPolicyPlugin", () => {
  it("has a stable name", () => {
    expect(controlsPolicyPlugin.name).toBe("controls-policy");
  });

  it("does nothing when no controls config is present", async () => {
    const ctx = makeContext();
    await controlsPolicyPlugin.init(ctx);
    expect(ctx.mediaPlayer.querySelector("style[data-playerstack='controls-policy']")).toBeNull();
  });

  it("injects a style block into mediaPlayer when controls.accent is set", async () => {
    const ctx = makeContext({ controls: { accent: "#008aff" } });
    await controlsPolicyPlugin.init(ctx);
    const style = ctx.mediaPlayer.querySelector("style[data-playerstack='controls-policy']");
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain("--ps-accent: #008aff");
  });

  it("injects hide rules when controls.show whitelist is provided", async () => {
    const ctx = makeContext({
      controls: { show: ["play", "progress"] },
    });
    await controlsPolicyPlugin.init(ctx);
    const style = ctx.mediaPlayer.querySelector("style[data-playerstack='controls-policy']");
    expect(style?.textContent).toContain("media-volume-slider");
    expect(style?.textContent).toContain("display: none");
  });

  it("does not duplicate the style block on repeated init", async () => {
    const ctx = makeContext({ controls: { accent: "#008aff" } });
    await controlsPolicyPlugin.init(ctx);
    await controlsPolicyPlugin.init(ctx);
    const styles = ctx.mediaPlayer.querySelectorAll("style[data-playerstack='controls-policy']");
    expect(styles.length).toBe(1);
  });

  it("destroy removes the injected style block from the right mediaPlayer", async () => {
    const ctx = makeContext({ controls: { accent: "#008aff" } });
    await controlsPolicyPlugin.init(ctx);
    controlsPolicyPlugin.destroy?.(ctx);
    const style = ctx.mediaPlayer.querySelector("style[data-playerstack='controls-policy']");
    expect(style).toBeNull();
  });

  it("isolates state between two contexts (multi-instance safe)", async () => {
    const a = makeContext({ controls: { accent: "#aaaaaa" } });
    const b = makeContext({ controls: { accent: "#bbbbbb" } });

    await controlsPolicyPlugin.init(a);
    await controlsPolicyPlugin.init(b);

    expect(
      a.mediaPlayer.querySelector("style[data-playerstack='controls-policy']")?.textContent,
    ).toContain("#aaaaaa");
    expect(
      b.mediaPlayer.querySelector("style[data-playerstack='controls-policy']")?.textContent,
    ).toContain("#bbbbbb");

    controlsPolicyPlugin.destroy?.(a);
    expect(a.mediaPlayer.querySelector("style[data-playerstack='controls-policy']")).toBeNull();
    expect(b.mediaPlayer.querySelector("style[data-playerstack='controls-policy']")).not.toBeNull();
  });
});
