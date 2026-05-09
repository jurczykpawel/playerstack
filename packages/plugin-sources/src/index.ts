import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";
import { resolveSource } from "./resolver";

export { resolveSource } from "./resolver";
export type { ResolvedSource } from "./resolver";

/**
 * Validates the configured source URL and sets it on the underlying media element.
 *
 * In the Mux media-elements ecosystem each element type accepts a native URL:
 *   <video src="https://files.example.com/v.mp4">
 *   <youtube-video src="https://youtu.be/ID">
 *   <vimeo-video src="https://vimeo.com/ID">
 *   <hls-video src="https://example.com/playlist.m3u8">
 *
 * Core (playerstack-element) already picks the right element tag from the URL,
 * so this plugin's job shrinks to (1) validate the URL is supported, (2) set
 * the src attribute (skipped if branded-thumb's clickToLoad mode wants to
 * defer load until user interaction).
 */
export const sourcesPlugin: PlayerstackPlugin = {
  name: "sources",
  async init(ctx: PlayerstackContext): Promise<void> {
    const brandedThumb = (ctx.config as { brandedThumb?: { clickToLoad?: boolean } }).brandedThumb;
    if (brandedThumb?.clickToLoad) {
      // branded-thumb plugin will set src after the user clicks the overlay.
      return;
    }
    const resolved = resolveSource(ctx.config.src);
    if (!resolved) {
      throw new Error(
        `[playerstack] cannot resolve source: "${ctx.config.src}" — supported: YouTube, Vimeo, MP4, HLS, WebM, DASH`,
      );
    }
    ctx.mediaPlayer.setAttribute("src", ctx.config.src);
  },
};
