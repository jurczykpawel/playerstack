import { Playerstack } from "@playerstack/core";
import { sourcesPlugin } from "@playerstack/plugin-sources";
import { controlsPolicyPlugin } from "@playerstack/plugin-controls-policy";
import { autopreviewPlugin } from "@playerstack/plugin-autopreview";
import { brandedThumbPlugin } from "@playerstack/plugin-branded-thumb";
import { ctaEndPlugin } from "@playerstack/plugin-cta-end";
import { chaptersPlugin } from "@playerstack/plugin-chapters";
import { actionBarPlugin } from "@playerstack/plugin-action-bar";
import { emailGatePlugin } from "@playerstack/plugin-email-gate";
import { savedPositionPlugin } from "@playerstack/plugin-saved-position";
import { stickyPlugin } from "@playerstack/plugin-sticky";
import { analyticsPlugin } from "@playerstack/plugin-analytics";
import { ytSubscribePlugin } from "@playerstack/plugin-yt-subscribe";
import { watermarkPlugin } from "@playerstack/plugin-watermark";
import { customCssPlugin } from "@playerstack/plugin-custom-css";
import { introCardPlugin } from "@playerstack/plugin-intro-card";

Playerstack.use(sourcesPlugin)
  .use(controlsPolicyPlugin)
  .use(autopreviewPlugin)
  .use(brandedThumbPlugin)
  .use(emailGatePlugin)
  .use(savedPositionPlugin)
  .use(actionBarPlugin)
  .use(chaptersPlugin)
  .use(ctaEndPlugin)
  .use(stickyPlugin)
  .use(ytSubscribePlugin)
  .use(analyticsPlugin)
  .use(watermarkPlugin)
  .use(customCssPlugin)
  .use(introCardPlugin)
  .define();

export { Playerstack };
export type { PlayerstackPlugin, PlayerstackContext, PlayerstackConfig } from "@playerstack/core";
