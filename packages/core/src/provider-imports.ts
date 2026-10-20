import type { LazyMediaElementTag } from "./providers";

/**
 * Default provider loader for bundler users (npm): dynamic `import()` lets the
 * consumer's bundler split each provider into its own chunk. The standalone
 * build replaces this module (see packages/embed/build.ts).
 */
export async function importProvider(tag: LazyMediaElementTag): Promise<void> {
  switch (tag) {
    case "youtube-video":
      await import("youtube-video-element");
      return;
    case "hls-video":
      await import("hls-video-element");
      return;
    case "vimeo-video":
      await import("vimeo-video-element");
      return;
    case "wistia-video":
      await import("wistia-video-element");
      return;
    case "twitch-video":
      await import("twitch-video-element");
      return;
  }
}
