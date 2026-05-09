import { Playerstack } from "@playerstack/core";
import { sourcesPlugin } from "@playerstack/plugin-sources";
import { controlsPolicyPlugin } from "@playerstack/plugin-controls-policy";
import { autopreviewPlugin } from "@playerstack/plugin-autopreview";
import { brandedThumbPlugin } from "@playerstack/plugin-branded-thumb";
import { ctaEndPlugin } from "@playerstack/plugin-cta-end";

Playerstack.use(sourcesPlugin)
  .use(controlsPolicyPlugin)
  .use(autopreviewPlugin)
  .use(brandedThumbPlugin)
  .use(ctaEndPlugin)
  .define();

export { Playerstack };
export type { PlayerstackPlugin, PlayerstackContext, PlayerstackConfig } from "@playerstack/core";
