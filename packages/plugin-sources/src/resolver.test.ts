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
});
