import { describe, expect, it } from "vitest";
import { parseVimeo } from "./vimeo";

describe("parseVimeo", () => {
  it("parses vimeo.com/ID", () => {
    expect(parseVimeo("https://vimeo.com/123456789")).toEqual({
      type: "vimeo",
      id: "123456789",
    });
  });

  it("parses player.vimeo.com/video/ID", () => {
    expect(parseVimeo("https://player.vimeo.com/video/123456789")).toMatchObject({
      type: "vimeo",
      id: "123456789",
    });
  });

  it("parses vimeo.com/ID/HASH (private videos)", () => {
    expect(parseVimeo("https://vimeo.com/123456789/abcdef0123")).toMatchObject({
      type: "vimeo",
      id: "123456789",
      hash: "abcdef0123",
    });
  });

  it("rejects legacy vimeo/ID short form (Vidstack-era)", () => {
    expect(parseVimeo("vimeo/123456789")).toBeNull();
  });

  it("ignores trailing slashes and query strings", () => {
    expect(parseVimeo("https://vimeo.com/123456789/?autoplay=1")).toMatchObject({
      type: "vimeo",
      id: "123456789",
    });
  });

  it("returns null for non-vimeo hosts", () => {
    expect(parseVimeo("https://youtu.be/abc")).toBeNull();
    expect(parseVimeo("https://example.com/123")).toBeNull();
  });

  it("returns null for vimeo URLs without numeric id", () => {
    expect(parseVimeo("https://vimeo.com/channels/staffpicks")).toBeNull();
    expect(parseVimeo("https://vimeo.com/")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseVimeo("")).toBeNull();
    expect(parseVimeo("not-a-url")).toBeNull();
  });
});
