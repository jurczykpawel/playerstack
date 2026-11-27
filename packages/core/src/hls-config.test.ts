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
import { setProviderImporter } from "./providers";

definePlayerstackElement();
setProviderImporter(async (tag) => {
  customElements.define(tag, class extends HTMLElement {});
});
afterEach(() => {
  document.body.replaceChildren();
  setPluginsForElement([]);
});

type WithConfig = HTMLElement & { config?: unknown };

async function mount(src: string, tag: string, data: Record<string, unknown>) {
  let initial: unknown;
  setPluginsForElement([
    { name: "inspect", init: (ctx) => void (initial = (ctx.mediaPlayer as WithConfig).config) },
  ]);
  document.body.innerHTML = `<player-stack src="${src}" data-config='${JSON.stringify(data)}'></player-stack>`;
  await vi.waitFor(() => expect(document.querySelector(tag)?.hasAttribute("src")).toBe(true));
  return { media: document.querySelector<WithConfig>(tag)!, initial: () => initial };
}

describe("config.hls", () => {
  it("reaches <hls-video> before plugins assign a source", async () => {
    const hls = { abrEwmaDefaultEstimate: 1_200_000 };
    const { media, initial } = await mount("https://example.com/v.m3u8", "hls-video", { hls });
    expect(initial()).toEqual(hls);
    expect(media.config).toEqual(hls);
  });

  it("leaves the provider default when unset", async () => {
    const { media } = await mount("https://example.com/v.m3u8", "hls-video", {});
    expect(media.config).toBeUndefined();
  });

  it("is not applied to other media elements", async () => {
    const { media } = await mount("https://example.com/v.mp4", "video", {
      hls: { startLevel: 1 },
    });
    expect("config" in media).toBe(false);
  });
});
