import { parseFile, type FileSource } from "./file";

export interface BunnySource {
  /** Same shape as FileSource (mp4 / hls / webm / dash) — Bunny serves direct files. */
  type: "mp4" | "hls" | "webm" | "dash";
  provider: "bunny";
  /** Pull Zone hostname, e.g. "vz-abc123.b-cdn.net". */
  zone: string;
}

const BUNNY_CDN_HOST = /(?:^|\.)b-cdn\.net$/i;
const BUNNY_IFRAME_HOST = /^iframe\.mediadelivery\.net$/i;

/**
 * Recognize Bunny Stream / Bunny CDN URLs. HLS playlists and MP4 files served
 * from Bunny's b-cdn.net domains map straight onto the FileSource shape (Mux
 * `<hls-video>` / native `<video>` handle them). The iframe embed at
 * `iframe.mediadelivery.net/embed/{library}/{video}` is rejected with a
 * dedicated error path — callers should request the HLS playlist URL from
 * Bunny Stream (Library → Embed → "HLS playlist URL") instead.
 */
export function parseBunny(input: string): BunnySource | null {
  if (!input) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (BUNNY_IFRAME_HOST.test(url.hostname)) {
    throw new Error(
      "[playerstack:sources] Bunny iframe embed (iframe.mediadelivery.net) is not supported — " +
        "use the HLS playlist URL from Bunny Stream → Library → Embed → 'HLS playlist URL'.",
    );
  }

  if (!BUNNY_CDN_HOST.test(url.hostname)) return null;

  const file = parseFile(input);
  if (!file) return null;

  return { type: file.type, provider: "bunny", zone: url.hostname };
}

export type { FileSource };
