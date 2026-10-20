import { Playerstack } from "@playerstack/core";
import { resolveScriptBase } from "@playerstack/core/script-loader";
import { sourcesPlugin } from "@playerstack/plugin-sources";
import type { LazyPluginName } from "../plugin-manifest";
import { createLazyPlugins } from "./lazy-plugins";
import { createScriptPluginImporter } from "./script-plugin-imports";

declare const __PLAYERSTACK_PLUGIN_FILES__: Record<LazyPluginName, string>;

const importer = createScriptPluginImporter({
  base: resolveScriptBase(document.currentScript, document),
  files: __PLAYERSTACK_PLUGIN_FILES__,
  document,
});
for (const plugin of createLazyPlugins(sourcesPlugin, importer)) Playerstack.use(plugin);
Playerstack.define();

export { Playerstack };
