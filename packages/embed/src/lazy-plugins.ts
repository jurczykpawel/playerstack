import type { PlayerstackConfig, PlayerstackContext, PlayerstackPlugin } from "@playerstack/core";
import { LAZY_PLUGINS, type LazyPluginName } from "../plugin-manifest";

export type PluginImporter = (name: LazyPluginName) => Promise<PlayerstackPlugin>;

function isEnabled(entry: (typeof LAZY_PLUGINS)[number], config: PlayerstackConfig): boolean {
  const value = config[entry.configKey] as { enabled?: boolean; points?: unknown[] } | undefined;
  if (entry.name === "controls-policy") return !!value;
  if (entry.name === "chapters") return !!value?.points?.length;
  return !!value?.enabled;
}

export function createLazyPlugins(
  sources: PlayerstackPlugin,
  importer: PluginImporter,
): PlayerstackPlugin[] {
  const cancelled = new WeakSet<PlayerstackContext>();
  const pending = new Map<LazyPluginName, Promise<PlayerstackPlugin>>();
  const prepared = new WeakMap<
    PlayerstackContext,
    Map<LazyPluginName, PlayerstackPlugin | undefined>
  >();

  function load(name: LazyPluginName): Promise<PlayerstackPlugin> {
    let loading = pending.get(name);
    if (!loading) {
      loading = Promise.resolve().then(() => importer(name));
      pending.set(name, loading);
      loading.catch(() => pending.delete(name));
    }
    return loading;
  }

  async function prepare(
    ctx: PlayerstackContext,
    name: LazyPluginName,
    loaded: Map<LazyPluginName, PlayerstackPlugin | undefined>,
  ): Promise<void> {
    try {
      loaded.set(name, await load(name));
    } catch (error) {
      loaded.set(name, undefined);
      if (cancelled.has(ctx)) return;
      ctx.container.dispatchEvent(
        new CustomEvent("playerstack:error", {
          bubbles: true,
          detail: { reason: "plugin-load", plugin: name, error },
        }),
      );
    }
  }

  return [
    {
      name: sources.name,
      async init(ctx) {
        cancelled.delete(ctx);
        const loaded = new Map<LazyPluginName, PlayerstackPlugin | undefined>();
        prepared.set(ctx, loaded);
        // Finish network waits before sources sets src and media events can fire.
        await Promise.all(
          LAZY_PLUGINS.filter((entry) => isEnabled(entry, ctx.config)).map(({ name }) =>
            prepare(ctx, name, loaded),
          ),
        );
        if (cancelled.has(ctx)) return;
        await sources.init(ctx);
        const thumb = ctx.config.brandedThumb as
          { enabled?: boolean; clickToLoad?: boolean } | undefined;
        if (thumb?.enabled && thumb.clickToLoad && !loaded.get("branded-thumb")) {
          ctx.mediaPlayer.setAttribute("src", ctx.config.src);
        }
      },
      destroy(ctx) {
        cancelled.add(ctx);
        sources.destroy?.(ctx);
        prepared.delete(ctx);
      },
    },
    ...LAZY_PLUGINS.map((entry): PlayerstackPlugin => ({
      name: entry.name,
      async init(ctx) {
        if (!isEnabled(entry, ctx.config) || cancelled.has(ctx)) return;
        let loaded = prepared.get(ctx);
        if (!loaded) {
          loaded = new Map();
          prepared.set(ctx, loaded);
        }
        if (!loaded.has(entry.name)) await prepare(ctx, entry.name, loaded);
        if (cancelled.has(ctx)) return;
        await loaded.get(entry.name)?.init(ctx);
      },
      destroy(ctx) {
        prepared.get(ctx)?.get(entry.name)?.destroy?.(ctx);
      },
    })),
  ];
}
