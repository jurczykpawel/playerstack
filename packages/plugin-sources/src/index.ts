import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";
import { resolveSource } from "./resolver";

export { resolveSource } from "./resolver";
export type { ResolvedSource } from "./resolver";

/**
 * Validates the configured source URL and sets it on the underlying media
 * element. Each Mux media-element accepts the same URL we received:
 *   <video src="https://files.example.com/v.mp4">
 *   <youtube-video src="https://youtu.be/ID">
 *   <vimeo-video src="https://vimeo.com/ID">
 *   <hls-video src="https://example.com/playlist.m3u8">
 *
 * Core (playerstack-element) already picks the right element tag. This
 * plugin's job is to (1) call resolveSource() — throws when the URL is not
 * a supported source, (2) set the `src` attribute (skipped under
 * `brandedThumb.clickToLoad`, where branded-thumb writes `src` on user
 * click instead).
 */
export const sourcesPlugin: PlayerstackPlugin = {
  name: "sources",
  async init(ctx: PlayerstackContext): Promise<void> {
    // Resolve first, regardless of clickToLoad. branded-thumb writes
    // ctx.config.src verbatim on user click, so resolution has to happen
    // here before any later plugin trusts the value.
    const resolved = resolveSource(ctx.config.src);
    if (!resolved) {
      throw new Error(
        `[playerstack] cannot resolve source: "${ctx.config.src}" — supported: YouTube, Vimeo, MP4, HLS, WebM, DASH`,
      );
    }

    const brandedThumb = (ctx.config as { brandedThumb?: { clickToLoad?: boolean } }).brandedThumb;
    if (brandedThumb?.clickToLoad) {
      // branded-thumb plugin will set `src` after the user clicks the overlay.
      return;
    }

    ctx.mediaPlayer.setAttribute("src", ctx.config.src);
  },
};
