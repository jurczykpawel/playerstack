import type { PlayerstackPlugin } from "@playerstack/core";

const key = Symbol.for("playerstack.plugin-modules");
type ModuleGlobal = typeof globalThis & { [key]?: Map<string, PlayerstackPlugin> };

export function pluginModules(): Map<string, PlayerstackPlugin> {
  const shared = globalThis as ModuleGlobal;
  return (shared[key] ??= new Map());
}

export function registerPlugin(plugin: PlayerstackPlugin): void {
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) throw new Error("plugin script URL is missing");
  pluginModules().set(script.src, plugin);
}
