import { describe, expect, it } from "vitest";
import { parseBunny } from "./bunny";

describe("parseBunny", () => {
  it("classifies Bunny Stream HLS playlists with provider=bunny", () => {
    expect(parseBunny("https://vz-abc123.b-cdn.net/library/playlist.m3u8")).toEqual({
      type: "hls",
      provider: "bunny",
      zone: "vz-abc123.b-cdn.net",
    });
  });

  it("classifies Bunny CDN MP4 files with provider=bunny", () => {
    expect(parseBunny("https://cdn.b-cdn.net/clip.mp4")).toEqual({
      type: "mp4",
      provider: "bunny",
      zone: "cdn.b-cdn.net",
    });
  });

  it("classifies Bunny CDN WebM files", () => {
    expect(parseBunny("https://cdn.b-cdn.net/clip.webm")).toMatchObject({
      type: "webm",
      provider: "bunny",
    });
  });

  it("throws on iframe.mediadelivery.net embed URLs with a dedicated error", () => {
    expect(() => parseBunny("https://iframe.mediadelivery.net/embed/12345/abcdef")).toThrow(
      /Bunny iframe embed/i,
    );
  });

  it("returns null for non-Bunny hosts", () => {
    expect(parseBunny("https://example.com/clip.mp4")).toBeNull();
  });

  it("returns null when the path has no recognized file extension", () => {
    expect(parseBunny("https://vz-abc.b-cdn.net/library/")).toBeNull();
  });

  it("returns null for empty / malformed input", () => {
    expect(parseBunny("")).toBeNull();
    expect(parseBunny("not a url")).toBeNull();
  });
});
