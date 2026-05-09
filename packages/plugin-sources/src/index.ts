import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";
import { resolveSource } from "./resolver";

export { resolveSource } from "./resolver";
export type { ResolvedSource } from "./resolver";

export const sourcesPlugin: PlayerstackPlugin = {
  name: "sources",
  async init(ctx: PlayerstackContext): Promise<void> {
    const resolved = resolveSource(ctx.config.src);
    if (!resolved) {
      throw new Error(
        `[playerstack] cannot resolve source: "${ctx.config.src}" — supported: YouTube, Vimeo, MP4, HLS, WebM, DASH`,
      );
    }
    ctx.mediaPlayer.setAttribute("src", resolved.vidstackSrc);
  },
};
