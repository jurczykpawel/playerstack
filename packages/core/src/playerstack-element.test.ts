import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("media-chrome/dist/media-controller.js", () => ({}));
vi.mock("media-chrome/dist/media-keyboard-shortcuts-dialog.js", () => ({}));
vi.mock("media-chrome/dist/media-control-bar.js", () => ({}));
vi.mock("media-chrome/dist/media-play-button.js", () => ({}));
vi.mock("media-chrome/dist/media-mute-button.js", () => ({}));
vi.mock("media-chrome/dist/media-time-display.js", () => ({}));
vi.mock("media-chrome/dist/media-time-range.js", () => ({}));
vi.mock("media-chrome/dist/media-fullscreen-button.js", () => ({}));
import { definePlayerstackElement, setPluginsForElement } from "./playerstack-element";

definePlayerstackElement();
afterEach(() => {
  document.body.replaceChildren();
  setPluginsForElement([]);
  vi.unstubAllGlobals();
});

async function mount(attrs: string) {
  document.body.innerHTML = `<player-stack src="https://example.com/v.mp4" ${attrs}></player-stack>`;
  await vi.waitFor(() => expect(document.querySelector("video")?.hasAttribute("src")).toBe(true));
  return document.querySelector("video")!;
}

describe("initial playback preferences", () => {
  it.each(["none", "metadata", "auto"])(
    "sets preload=%s before plugins assign a source",
    async (preload) => {
      let initial: string | null | undefined;
      setPluginsForElement([
        {
          name: "inspect",
          init(ctx) {
            initial = ctx.mediaPlayer.getAttribute("preload");
          },
        },
      ]);
      const media = await mount(`preload="${preload}"`);
      expect(initial).toBe(preload);
      expect(media.preload).toBe(preload);
    },
  );
  it("accepts preload from JSON with existing config precedence", async () => {
    const media = await mount(
      `preload="auto" data-config='{"preload":"none","preview":{"enabled":true}}'`,
    );
    expect(media.preload).toBe("none");
    expect(media.autoplay).toBe(false);
  });
  it("does not enable preview before connecting when reduced motion is requested", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const media = await mount(`data-config='{"preview":{"enabled":true}}'`);
    expect(media.autoplay).toBe(false);
    expect(media.hasAttribute("muted")).toBe(false);
    expect(media.loop).toBe(false);
  });
  it("preserves normal preview", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const media = await mount(`data-config='{"preview":{"enabled":true}}'`);
    expect(media.autoplay).toBe(true);
    expect(media.loop).toBe(true);
  });
});
