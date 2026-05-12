import { describe, expect, it } from "vitest";
import { parseWistia } from "./wistia";

describe("parseWistia", () => {
  it("resolves account-subdomain medias URLs", () => {
    expect(parseWistia("https://wesleyluyten.wistia.com/medias/oifkgmxnkb")).toEqual({
      type: "wistia",
      id: "oifkgmxnkb",
    });
  });

  it("resolves fast.wistia.com/embed/iframe/{id}", () => {
    expect(parseWistia("https://fast.wistia.com/embed/iframe/abcdef1234")).toEqual({
      type: "wistia",
      id: "abcdef1234",
    });
  });

  it("resolves fast.wistia.com/embed/medias/{id}", () => {
    expect(parseWistia("https://fast.wistia.com/embed/medias/abcdef1234")).toEqual({
      type: "wistia",
      id: "abcdef1234",
    });
  });

  it("resolves wi.st short URLs", () => {
    expect(parseWistia("https://wi.st/medias/abcdef1234")).toEqual({
      type: "wistia",
      id: "abcdef1234",
    });
  });

  it("returns null for non-Wistia hosts", () => {
    expect(parseWistia("https://example.com/medias/abcdef1234")).toBeNull();
  });

  it("returns null for unrecognized paths on a Wistia host", () => {
    expect(parseWistia("https://wistia.com/about")).toBeNull();
  });

  it("returns null for empty / malformed input", () => {
    expect(parseWistia("")).toBeNull();
    expect(parseWistia("not a url")).toBeNull();
  });

  it("returns null for non-http(s) protocols", () => {
    expect(parseWistia("javascript:alert(1)")).toBeNull();
  });
});
