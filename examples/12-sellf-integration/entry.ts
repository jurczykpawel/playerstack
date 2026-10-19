// Custom Playerstack build with the Sellf config provider. The scoped
// @playerstack/* packages are not on npm yet and the hosted standalone script
// does not include the Sellf adapter, so this example builds from the repo:
//   bun build examples/12-sellf-integration/entry.ts --format=iife --minify \
//     --outfile examples/12-sellf-integration/dist/playerstack-sellf.js
// 1. Install the Sellf config provider BEFORE anything defines <player-stack>
//    (must stay the first import).
import "./sellf-provider";
import { Playerstack } from "../../packages/core/src/playerstack";
import { sourcesPlugin } from "../../packages/plugin-sources/src/index";
import { controlsPolicyPlugin } from "../../packages/plugin-controls-policy/src/index";
import { brandedThumbPlugin } from "../../packages/plugin-branded-thumb/src/index";
import { ctaEndPlugin } from "../../packages/plugin-cta-end/src/index";

// 2. Register plugins as usual
Playerstack.use(sourcesPlugin)
  .use(controlsPolicyPlugin)
  .use(brandedThumbPlugin)
  .use(ctaEndPlugin)
  .define();
