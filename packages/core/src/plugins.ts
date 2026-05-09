import type { EventBus } from "./events";

export interface PlayerstackContext {
  events: EventBus;
  container: HTMLElement;
  mediaPlayer: HTMLElement;
}

export interface PlayerstackPlugin {
  readonly name: string;
  init(ctx: PlayerstackContext): void | Promise<void>;
  destroy?(): void;
}

export interface PluginRegistry {
  register(plugin: PlayerstackPlugin): void;
  list(): readonly PlayerstackPlugin[];
  init(ctx: PlayerstackContext): Promise<void>;
  destroy(): void;
}

export function createPluginRegistry(): PluginRegistry {
  const plugins: PlayerstackPlugin[] = [];
  let initialized = false;

  function register(plugin: PlayerstackPlugin): void {
    if (plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`[playerstack] plugin "${plugin.name}" is already registered`);
    }
    plugins.push(plugin);
  }

  function list(): readonly PlayerstackPlugin[] {
    return plugins;
  }

  async function init(ctx: PlayerstackContext): Promise<void> {
    if (initialized) {
      throw new Error("[playerstack] plugin registry already initialized — call destroy() first");
    }
    initialized = true;
    for (const plugin of plugins) {
      await plugin.init(ctx);
    }
  }

  function destroy(): void {
    for (let i = plugins.length - 1; i >= 0; i--) {
      const plugin = plugins[i];
      if (!plugin?.destroy) continue;
      try {
        plugin.destroy();
      } catch (err) {
        console.error(`[playerstack] destroy of plugin "${plugin.name}" threw:`, err);
      }
    }
    initialized = false;
  }

  return { register, list, init, destroy };
}
