import { definePlayerstackElement, setPluginsForElement } from "./playerstack-element";
import type { PlayerstackPlugin } from "./plugins";

const plugins: PlayerstackPlugin[] = [];

export interface PlayerstackApi {
  use(plugin: PlayerstackPlugin): PlayerstackApi;
  plugins(): readonly PlayerstackPlugin[];
  define(): void;
}

export const Playerstack: PlayerstackApi = {
  use(plugin: PlayerstackPlugin): PlayerstackApi {
    if (plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`[playerstack] plugin "${plugin.name}" is already registered`);
    }
    plugins.push(plugin);
    setPluginsForElement(plugins);
    return Playerstack;
  },
  plugins(): readonly PlayerstackPlugin[] {
    return plugins;
  },
  define(): void {
    setPluginsForElement(plugins);
    definePlayerstackElement();
  },
};

export function _resetForTesting(): void {
  plugins.length = 0;
  setPluginsForElement(plugins);
}
