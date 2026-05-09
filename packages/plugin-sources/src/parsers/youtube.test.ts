import { describe, expect, it } from "vitest";
import { parseYouTube } from "./youtube";

describe("parseYouTube", () => {
  it("parses youtu.be short links", () => {
    expect(parseYouTube("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      type: "youtube",
      id: "dQw4w9WgXcQ",
      vidstackSrc: "youtube/dQw4w9WgXcQ",
    });
  });

  it("parses youtu.be with query string", () => {
    expect(parseYouTube("https://youtu.be/dQw4w9WgXcQ?t=10")).toMatchObject({
      type: "youtube",
      id: "dQw4w9WgXcQ",
    });
  });

  it("parses youtube.com/watch?v=ID", () => {
    expect(parseYouTube("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({
      type: "youtube",
      id: "dQw4w9WgXcQ",
    });
  });

  it("parses youtube.com/watch with extra query params", () => {
    expect(
      parseYouTube("https://www.youtube.com/watch?feature=youtu.be&v=dQw4w9WgXcQ&t=42"),
    ).toMatchObject({ type: "youtube", id: "dQw4w9WgXcQ" });
  });

  it("parses youtube.com/embed/ID", () => {
    expect(parseYouTube("https://www.youtube.com/embed/dQw4w9WgXcQ")).toMatchObject({
      type: "youtube",
      id: "dQw4w9WgXcQ",
    });
  });

  it("parses youtube.com/shorts/ID", () => {
    expect(parseYouTube("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toMatchObject({
      type: "youtube",
      id: "dQw4w9WgXcQ",
    });
  });

  it("parses youtube.com/v/ID", () => {
    expect(parseYouTube("https://www.youtube.com/v/dQw4w9WgXcQ")).toMatchObject({
      type: "youtube",
      id: "dQw4w9WgXcQ",
    });
  });

  it("parses Vidstack short form youtube/ID", () => {
    expect(parseYouTube("youtube/dQw4w9WgXcQ")).toMatchObject({
      type: "youtube",
      id: "dQw4w9WgXcQ",
    });
  });

  it("supports m.youtube.com (mobile)", () => {
    expect(parseYouTube("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({
      type: "youtube",
      id: "dQw4w9WgXcQ",
    });
  });

  it("supports youtube-nocookie.com", () => {
    expect(parseYouTube("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toMatchObject({
      type: "youtube",
      id: "dQw4w9WgXcQ",
    });
  });

  it("returns null for non-youtube URLs", () => {
    expect(parseYouTube("https://vimeo.com/123456")).toBeNull();
    expect(parseYouTube("https://example.com/video.mp4")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseYouTube("")).toBeNull();
    expect(parseYouTube("not-a-url")).toBeNull();
    expect(parseYouTube("https://www.youtube.com/watch")).toBeNull();
  });

  it("rejects YouTube IDs that contain invalid chars", () => {
    expect(parseYouTube("https://youtu.be/abc!@#$%^&")).toBeNull();
  });

  it("accepts the canonical 11-char video ID format", () => {
    expect(parseYouTube("https://youtu.be/_-aZ09xY-Mz")).toMatchObject({
      id: "_-aZ09xY-Mz",
    });
  });
});
