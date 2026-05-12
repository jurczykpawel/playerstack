import { describe, expect, it } from "vitest";
import { parseTwitch } from "./twitch";

describe("parseTwitch", () => {
  it("resolves VOD URLs (twitch.tv/videos/{id})", () => {
    expect(parseTwitch("https://www.twitch.tv/videos/106400740")).toEqual({
      type: "twitch",
      kind: "video",
      id: "106400740",
    });
  });

  it("resolves channel URLs (twitch.tv/{channel})", () => {
    expect(parseTwitch("https://www.twitch.tv/shroud")).toEqual({
      type: "twitch",
      kind: "channel",
      id: "shroud",
    });
  });

  it("resolves clip URLs from clips.twitch.tv/{slug}", () => {
    expect(parseTwitch("https://clips.twitch.tv/FunnyClipSlug-abc")).toEqual({
      type: "twitch",
      kind: "clip",
      id: "FunnyClipSlug-abc",
    });
  });

  it("resolves clip URLs from twitch.tv/{channel}/clip/{slug}", () => {
    expect(parseTwitch("https://www.twitch.tv/shroud/clip/FunnyClipSlug-abc")).toEqual({
      type: "twitch",
      kind: "clip",
      id: "FunnyClipSlug-abc",
    });
  });

  it("resolves player.twitch.tv with ?video=", () => {
    expect(parseTwitch("https://player.twitch.tv/?video=106400740&parent=example.com")).toEqual({
      type: "twitch",
      kind: "video",
      id: "106400740",
    });
  });

  it("resolves player.twitch.tv with ?channel=", () => {
    expect(parseTwitch("https://player.twitch.tv/?channel=shroud&parent=example.com")).toEqual({
      type: "twitch",
      kind: "channel",
      id: "shroud",
    });
  });

  it("returns null for non-Twitch hosts", () => {
    expect(parseTwitch("https://example.com/videos/123")).toBeNull();
  });

  it("returns null for empty / malformed input", () => {
    expect(parseTwitch("")).toBeNull();
    expect(parseTwitch("not a url")).toBeNull();
  });

  it("returns null for non-http(s) protocols", () => {
    expect(parseTwitch("javascript:alert(1)")).toBeNull();
  });
});
