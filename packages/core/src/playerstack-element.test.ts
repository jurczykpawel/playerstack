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
import { setProviderImporter, _resetProvidersForTesting } from "./providers";

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
  it("does not autoplay, mute or loop the main media when preview.src is set", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const media = await mount(
      `data-config='{"preview":{"enabled":true,"src":"https://example.com/p.mp4"}}'`,
    );
    expect(media.autoplay).toBe(false);
    expect(media.loop).toBe(false);
    expect(media.hasAttribute("muted")).toBe(false);
  });
});

describe("fullscreen", () => {
  it("makes <player-stack> the fullscreen target so overlays stay inside it", async () => {
    await mount("");
    const controller = document.querySelector("media-controller") as HTMLElement & {
      fullscreenElement?: Element;
    };
    expect(controller.fullscreenElement).toBe(document.querySelector("player-stack"));
  });
});

describe("HLS on browsers that play it natively", () => {
  const M3U8 = "https://example.com/live.m3u8";

  function stubBrowser(vendor: string, native: string) {
    vi.spyOn(navigator, "vendor", "get").mockReturnValue(vendor);
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation((type) =>
      type === "application/vnd.apple.mpegurl" ? (native as CanPlayTypeResult) : "",
    );
  }

  async function mountHls(attrs = "") {
    const importer = vi.fn(async () => {
      throw new Error("hls.js requested");
    });
    setProviderImporter(importer);
    vi.spyOn(console, "error").mockImplementation(() => {});
    document.body.innerHTML = `<player-stack src="${M3U8}" ${attrs}></player-stack>`;
    return importer;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    _resetProvidersForTesting();
  });

  it("plays HLS in native <video> on Safari without loading hls.js", async () => {
    stubBrowser("Apple Computer, Inc.", "maybe");
    const importer = await mountHls();
    await vi.waitFor(() =>
      expect(document.querySelector("player-stack video")?.getAttribute("src")).toBe(M3U8),
    );
    expect(importer).not.toHaveBeenCalled();
  });

  it("keeps hls.js on Safari when config.hls sets hls.js options", async () => {
    stubBrowser("Apple Computer, Inc.", "maybe");
    const importer = await mountHls(`data-config='{"hls":{"startLevel":2}}'`);
    await vi.waitFor(() => expect(importer).toHaveBeenCalledWith("hls-video"));
  });

  it("keeps hls.js on non-Apple browsers that also report native HLS (Chrome)", async () => {
    stubBrowser("Google Inc.", "maybe");
    const importer = await mountHls();
    await vi.waitFor(() => expect(importer).toHaveBeenCalledWith("hls-video"));
  });
});
