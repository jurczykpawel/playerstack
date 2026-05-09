import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";
import { buildPolicyCss, type ControlsPolicyConfig } from "./policy";

export { buildPolicyCss, ALL_CONTROLS } from "./policy";
export type { ControlName, ControlsPolicyConfig } from "./policy";

const STYLE_MARKER = "controls-policy";

export const controlsPolicyPlugin: PlayerstackPlugin = {
  name: "controls-policy",
  async init(ctx: PlayerstackContext): Promise<void> {
    const controls = (ctx.config as { controls?: ControlsPolicyConfig }).controls;
    if (!controls) return;

    const css = buildPolicyCss(controls);
    if (!css) return;

    let style = ctx.mediaPlayer.querySelector<HTMLStyleElement>(
      `style[data-playerstack='${STYLE_MARKER}']`,
    );
    if (!style) {
      style = document.createElement("style");
      style.dataset.playerstack = STYLE_MARKER;
      ctx.mediaPlayer.appendChild(style);
    }
    style.textContent = css;
  },
  destroy(ctx: PlayerstackContext): void {
    const style = ctx.mediaPlayer.querySelector(
      `style[data-playerstack='${STYLE_MARKER}']`,
    );
    style?.remove();
  },
};
