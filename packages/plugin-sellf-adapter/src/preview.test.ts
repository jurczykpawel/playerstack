import { afterEach, expect, it, vi } from "vitest";
import { createSellfConfigProvider } from "./index";
import { normalizeRemoteConfig } from "./normalize";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it("carries preview.src and type from the API through the adapter", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        src: "movie.mp4",
        preview: {
          enabled: true,
          loopUntilInteraction: true,
          src: "https://cdn.example/preview.mp4",
          type: "video/mp4",
          unknown: "dropped",
        },
      }),
    ),
  );
  const element = document.createElement("div");
  element.setAttribute("data-sellf-product", "guide");
  const config = await createSellfConfigProvider({ baseUrl: "https://sellf.example" }).load(
    element,
  );
  expect(config.preview).toEqual({
    enabled: true,
    loopUntilInteraction: true,
    src: "https://cdn.example/preview.mp4",
    type: "video/mp4",
  });
});

it.each([
  ["/clips/preview.mp4"],
  ["preview.webm"],
  ["http://cdn.example/p.mp4"],
  [`https://cdn.example/${"a".repeat(2000)}.mp4`],
])("keeps http(s) preview.src (%#)", (src) => {
  expect(normalizeRemoteConfig({ preview: { src } }).preview).toEqual({ src });
});

it.each([
  ["javascript:alert(1)"],
  ["data:video/mp4;base64,AAAA"],
  ["blob:https://x.example/id"],
  ["file:///etc/passwd"],
  ["//[bad"],
  [`https://cdn.example/${"a".repeat(2048)}.mp4`],
  [""],
  [42],
  [null],
  [["https://cdn.example/p.mp4"]],
])("drops invalid preview.src (%j)", (src) => {
  expect(normalizeRemoteConfig({ preview: { enabled: true, src } }).preview).toEqual({
    enabled: true,
  });
});

it.each([["video/mp4"], ["video/webm"], ['video/mp4; codecs="avc1.42E01E"']])(
  "keeps video/* preview.type (%s)",
  (type) => {
    expect(normalizeRemoteConfig({ preview: { type } }).preview).toEqual({ type });
  },
);

it.each([
  ["audio/mp4"],
  ["text/html"],
  ["application/javascript"],
  ["video"],
  ["video/"],
  ["xvideo/mp4"],
  [" video/mp4"],
  ["video/" + "x".repeat(200)],
  [42],
  [null],
])("drops invalid preview.type (%j)", (type) => {
  expect(normalizeRemoteConfig({ preview: { enabled: false, type } }).preview).toEqual({
    enabled: false,
  });
});
