import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LAZY_MEDIA_ELEMENT_TAGS,
  ensureMediaElement,
  isLazyMediaElement,
  setProviderImporter,
  _resetProvidersForTesting,
} from "./providers";

/** happy-dom keeps one CustomElementRegistry per test file, so tests below use distinct tags. */
function defineLater(tag: string): () => Promise<void> {
  return async () => {
    customElements.define(tag, class extends HTMLElement {});
  };
}

afterEach(() => {
  _resetProvidersForTesting();
  vi.restoreAllMocks();
});

describe("isLazyMediaElement", () => {
  it("treats YouTube, HLS, Vimeo, Wistia and Twitch as lazily loaded providers", () => {
    expect(isLazyMediaElement("youtube-video")).toBe(true);
    expect(isLazyMediaElement("hls-video")).toBe(true);
    expect(isLazyMediaElement("vimeo-video")).toBe(true);
    expect(isLazyMediaElement("wistia-video")).toBe(true);
    expect(isLazyMediaElement("twitch-video")).toBe(true);
  });

  it("keeps native <video> in the core bundle", () => {
    expect(isLazyMediaElement("video")).toBe(false);
  });

  it("lists every lazy provider for the build, which must ship a file for each", () => {
    expect([...LAZY_MEDIA_ELEMENT_TAGS].sort()).toEqual([
      "hls-video",
      "twitch-video",
      "vimeo-video",
      "wistia-video",
      "youtube-video",
    ]);
  });
});

describe("ensureMediaElement", () => {
  it("does not call the importer for native <video> (MP4)", async () => {
    const importer = vi.fn();
    setProviderImporter(importer);
    await ensureMediaElement("video");
    expect(importer).not.toHaveBeenCalled();
  });

  it("imports the YouTube provider only when a YouTube player asks, and retries after a failure", async () => {
    const importer = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockImplementationOnce(defineLater("youtube-video"));
    setProviderImporter(importer);
    await ensureMediaElement("video");
    expect(importer).not.toHaveBeenCalled();
    await expect(ensureMediaElement("youtube-video")).rejects.toThrow("network down");
    await ensureMediaElement("youtube-video");
    expect(importer).toHaveBeenCalledTimes(2);
    expect(importer).toHaveBeenCalledWith("youtube-video");
    expect(customElements.get("youtube-video")).toBeDefined();
  });

  it("imports the HLS provider and resolves once the element is defined", async () => {
    const tag = "hls-video";
    const importer = vi.fn(defineLater(tag));
    setProviderImporter(importer);
    await ensureMediaElement(tag);
    expect(importer).toHaveBeenCalledWith("hls-video");
    expect(customElements.get(tag)).toBeDefined();
  });

  it("skips the importer when the provider element is already defined", async () => {
    // hls-video was defined by the previous test (shared registry).
    const importer = vi.fn();
    setProviderImporter(importer);
    await ensureMediaElement("hls-video");
    expect(importer).not.toHaveBeenCalled();
  });

  it("issues a single import for concurrent players of the same provider", async () => {
    const importer = vi.fn(defineLater("vimeo-video"));
    setProviderImporter(importer);
    await Promise.all([ensureMediaElement("vimeo-video"), ensureMediaElement("vimeo-video")]);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it("rejects when the import fails and allows a retry afterwards", async () => {
    const importer = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockImplementationOnce(defineLater("wistia-video"));
    setProviderImporter(importer);
    await expect(ensureMediaElement("wistia-video")).rejects.toThrow("network down");
    await ensureMediaElement("wistia-video");
    expect(importer).toHaveBeenCalledTimes(2);
    expect(customElements.get("wistia-video")).toBeDefined();
  });

  it("rejects when the provider loaded but did not define its element", async () => {
    setProviderImporter(vi.fn(async () => undefined));
    await expect(ensureMediaElement("twitch-video")).rejects.toThrow(/twitch-video/);
  });
});
