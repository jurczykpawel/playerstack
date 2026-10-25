import { definePlayerstackElement } from "./playerstack-element";

export { definePlayerstackElement, PlayerstackElement } from "./playerstack-element";
export { createEventBus } from "./events";
export type { EventBus, EventHandler, EventMap } from "./events";
export { createPluginRegistry } from "./plugins";
export type { PlayerstackPlugin, PlayerstackContext, PluginRegistry } from "./plugins";
export { createInlineConfigProvider } from "./config";
export type { ConfigProvider, PlayerstackConfig } from "./config";
export { Playerstack } from "./playerstack";
export type { PlayerstackApi } from "./playerstack";
export { sanitizeHtml, isSafeHttpUrl, buildSafeCtaUrl } from "./safe-html";
export { ensureMediaElement, isLazyMediaElement, setProviderImporter } from "./providers";
export type { MediaElementTag, LazyMediaElementTag, ProviderImporter } from "./providers";
export { createScriptProviderImporter, resolveScriptBase } from "./script-loader";

if (typeof window !== "undefined" && !customElements.get("player-stack")) {
  definePlayerstackElement();
}

export { activateOverlay, focusPlayerControl } from "./overlay";
