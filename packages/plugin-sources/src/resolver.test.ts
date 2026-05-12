import { describe, expect, it } from "vitest";
import { resolveSource } from "./resolver";

describe("resolveSource", () => {
  it("resolves YouTube URLs first", () => {
    const result = resolveSource("https://youtu.be/dQw4w9WgXcQ");
    expect(result).toMatchObject({ type: "youtube", id: "dQw4w9WgXcQ" });
  });

  it("resolves Vimeo URLs", () => {
    expect(resolveSource("https://vimeo.com/123456789")).toMatchObject({
      type: "vimeo",
      id: "123456789",
    });
  });

  it("resolves MP4 URLs", () => {
    expect(resolveSource("https://example.com/v.mp4")).toMatchObject({ type: "mp4" });
  });

  it("resolves HLS URLs", () => {
    expect(resolveSource("https://example.com/p.m3u8")).toMatchObject({ type: "hls" });
  });

  it("returns null for unsupported sources", () => {
    expect(resolveSource("https://example.com/v.avi")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(resolveSource("")).toBeNull();
  });

  it("trims surrounding whitespace before resolving", () => {
    expect(resolveSource("  https://youtu.be/dQw4w9WgXcQ  ")).toMatchObject({
      type: "youtube",
    });
  });

  it("rejects legacy youtube/ID and vimeo/ID short forms (Vidstack-era)", () => {
    expect(resolveSource("youtube/abc12345678")).toBeNull();
    expect(resolveSource("vimeo/123456789")).toBeNull();
  });

  it("resolves Wistia URLs", () => {
    expect(resolveSource("https://wesleyluyten.wistia.com/medias/oifkgmxnkb")).toMatchObject({
      type: "wistia",
      id: "oifkgmxnkb",
    });
  });

  it("resolves Twitch VOD URLs", () => {
    expect(resolveSource("https://www.twitch.tv/videos/106400740")).toMatchObject({
      type: "twitch",
      kind: "video",
      id: "106400740",
    });
  });

  it("resolves Twitch channel URLs", () => {
    expect(resolveSource("https://www.twitch.tv/shroud")).toMatchObject({
      type: "twitch",
      kind: "channel",
      id: "shroud",
    });
  });

  it("classifies Bunny CDN HLS URLs with provider=bunny", () => {
    expect(resolveSource("https://vz-abc123.b-cdn.net/library/playlist.m3u8")).toMatchObject({
      type: "hls",
      provider: "bunny",
      zone: "vz-abc123.b-cdn.net",
    });
  });

  it("classifies Bunny CDN MP4 URLs with provider=bunny", () => {
    expect(resolveSource("https://cdn.b-cdn.net/some/clip.mp4")).toMatchObject({
      type: "mp4",
      provider: "bunny",
    });
  });

  it("rejects Bunny iframe embed with a dedicated error", () => {
    expect(() => resolveSource("https://iframe.mediadelivery.net/embed/12345/abcdef")).toThrow(
      /Bunny iframe embed/i,
    );
  });
});
