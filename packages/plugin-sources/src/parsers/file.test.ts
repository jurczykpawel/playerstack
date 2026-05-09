import { describe, expect, it } from "vitest";
import { parseFile } from "./file";

describe("parseFile", () => {
  it("detects MP4 by .mp4 extension", () => {
    expect(parseFile("https://files.example.com/v.mp4")).toEqual({ type: "mp4" });
  });

  it("detects MP4 ignoring query string", () => {
    expect(parseFile("https://example.com/v.mp4?token=abc")).toMatchObject({
      type: "mp4",
    });
  });

  it("detects HLS by .m3u8 extension", () => {
    expect(parseFile("https://stream.example.com/playlist.m3u8")).toEqual({ type: "hls" });
  });

  it("detects WebM by .webm extension", () => {
    expect(parseFile("https://example.com/v.webm")).toMatchObject({ type: "webm" });
  });

  it("detects DASH by .mpd extension", () => {
    expect(parseFile("https://example.com/manifest.mpd")).toMatchObject({ type: "dash" });
  });

  it("returns null for unsupported extensions", () => {
    expect(parseFile("https://example.com/v.avi")).toBeNull();
    expect(parseFile("https://example.com/v.mov")).toBeNull();
  });

  it("returns null when the URL has no recognizable extension", () => {
    expect(parseFile("https://example.com/some-video")).toBeNull();
  });

  it("returns null for non-http(s) URLs", () => {
    expect(parseFile("file:///tmp/v.mp4")).toBeNull();
    expect(parseFile("ftp://example.com/v.mp4")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseFile("")).toBeNull();
    expect(parseFile("not-a-url")).toBeNull();
  });

  it("treats extension matching as case-insensitive", () => {
    expect(parseFile("https://example.com/V.MP4")).toMatchObject({ type: "mp4" });
    expect(parseFile("https://example.com/V.M3U8")).toMatchObject({ type: "hls" });
  });
});
