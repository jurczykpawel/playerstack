// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { PlayerstackContext, PlayerstackPlugin } from "@playerstack/core";
import { createEventBus } from "../../core/src/events";
import { createPluginRegistry } from "../../core/src/plugins";
import { createLazyPlugins } from "./lazy-plugins";
import { LAZY_PLUGINS } from "../plugin-manifest";

function context(config: Record<string, unknown> = {}): PlayerstackContext {
  return {
    config: { src: "https://example.com/video.mp4", ...config },
    container: document.createElement("div"),
    mediaPlayer: document.createElement("video"),
    events: createEventBus(),
  };
}

function source(): PlayerstackPlugin {
  return { name: "sources", init: vi.fn() };
}

async function initialize(plugins: PlayerstackPlugin[], ctx: PlayerstackContext) {
  const registry = createPluginRegistry();
  plugins.forEach((p) => registry.register(p));
  await registry.init(ctx);
  return registry;
}

describe("conditional standalone plugins", () => {
  it("preserves all 15 registered names and skips imports for an unconfigured player", async () => {
    const importer = vi.fn();
    const sources = source();
    const plugins = createLazyPlugins(sources, importer);
    expect(plugins.map((p) => p.name)).toEqual([
      "sources",
      "controls-policy",
      "autopreview",
      "branded-thumb",
      "email-gate",
      "saved-position",
      "action-bar",
      "chapters",
      "cta-end",
      "sticky",
      "yt-subscribe",
      "analytics",
      "watermark",
      "custom-css",
      "intro-card",
    ]);
    const ctx = context();
    await initialize(plugins, ctx);
    expect(importer).not.toHaveBeenCalled();
    expect(sources.init).toHaveBeenCalledWith(ctx);
  });

  it.each(LAZY_PLUGINS)("loads only $name when its configuration is active", async (entry) => {
    const plugin = { name: entry.name, init: vi.fn(), destroy: vi.fn() };
    const importer = vi.fn().mockResolvedValue(plugin);
    const enabled =
      entry.name === "controls-policy"
        ? {}
        : entry.name === "chapters"
          ? { points: [{ time: 0, label: "Start" }] }
          : { enabled: true };
    const ctx = context({ [entry.configKey]: enabled });
    const registry = await initialize(createLazyPlugins(source(), importer), ctx);
    expect(importer).toHaveBeenCalledExactlyOnceWith(entry.name);
    expect(plugin.init).toHaveBeenCalledExactlyOnceWith(ctx);
    expect(plugin.init.mock.calls[0]![0]).toBe(ctx);
    registry.destroy();
    expect(plugin.destroy).toHaveBeenCalledExactlyOnceWith(ctx);
  });

  it("does not load disabled flags or empty chapter lists", async () => {
    const importer = vi.fn();
    const config = Object.fromEntries(
      LAZY_PLUGINS.filter((p) => p.name !== "controls-policy").map((p) => [
        p.configKey,
        { enabled: false, points: [] },
      ]),
    );
    await initialize(createLazyPlugins(source(), importer), context(config));
    expect(importer).not.toHaveBeenCalled();
  });

  it("shares one pending import across players and forwards each original context", async () => {
    let resolve!: (plugin: PlayerstackPlugin) => void;
    const importer = vi.fn(
      () =>
        new Promise<PlayerstackPlugin>((r) => {
          resolve = r;
        }),
    );
    const sources = source();
    const plugins = createLazyPlugins(sources, importer);
    const a = context({ ctaEnd: { enabled: true } });
    const b = context({ ctaEnd: { enabled: true } });
    const first = initialize(plugins, a);
    const second = initialize(plugins, b);
    await vi.waitFor(() => expect(importer).toHaveBeenCalledTimes(1));
    expect(sources.init).not.toHaveBeenCalled();
    const init = vi.fn();
    resolve({ name: "cta-end", init });
    await Promise.all([first, second]);
    expect(init.mock.calls[0]![0]).toBe(a);
    expect(init.mock.calls[1]![0]).toBe(b);
  });

  it("downloads all enabled code before sources and retains init and event order", async () => {
    const trace: string[] = [];
    const sources = {
      name: "sources",
      init() {
        trace.push("sources");
      },
    };
    const ctx = context({ ctaEnd: { enabled: true }, analytics: { enabled: true } });
    ctx.events.on("intro-card:play-click", () => trace.push("event"));
    const importer = vi.fn(async (name: string) => {
      trace.push(`load:${name}`);
      return {
        name,
        init(same: PlayerstackContext) {
          trace.push(name);
          if (name === "analytics") same.events.emit("intro-card:play-click", undefined);
        },
      };
    });
    await initialize(createLazyPlugins(sources, importer), ctx);
    expect(trace).toEqual([
      "load:cta-end",
      "load:analytics",
      "sources",
      "cta-end",
      "analytics",
      "event",
    ]);
  });

  it("reports a load failure per player, continues playback, and retries for the next player", async () => {
    const plugin = { name: "cta-end", init: vi.fn() };
    const importer = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(plugin);
    const sources = source();
    const plugins = createLazyPlugins(sources, importer);
    const ctx = context({ ctaEnd: { enabled: true } });
    const onError = vi.fn();
    ctx.container.addEventListener("playerstack:error", onError);
    await initialize(plugins, ctx);
    expect(sources.init).toHaveBeenCalledWith(ctx);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0].detail).toMatchObject({
      reason: "plugin-load",
      plugin: "cta-end",
    });
    await initialize(plugins, context({ ctaEnd: { enabled: true } }));
    expect(importer).toHaveBeenCalledTimes(2);
    expect(plugin.init).toHaveBeenCalledTimes(1);
  });

  it("releases a validated click-to-load source when its poster plugin cannot download", async () => {
    const ctx = context({ brandedThumb: { enabled: true, clickToLoad: true } });
    await initialize(
      createLazyPlugins(source(), vi.fn().mockRejectedValue(new Error("offline"))),
      ctx,
    );
    expect(ctx.mediaPlayer.getAttribute("src")).toBe(ctx.config.src);
  });

  it("propagates init failures without calling them download failures", async () => {
    const ctx = context({ ctaEnd: { enabled: true } });
    const onError = vi.fn();
    ctx.container.addEventListener("playerstack:error", onError);
    const importer = vi.fn().mockResolvedValue({
      name: "cta-end",
      init() {
        throw new Error("init failed");
      },
    });
    await expect(initialize(createLazyPlugins(source(), importer), ctx)).rejects.toThrow(
      "init failed",
    );
    expect(onError).not.toHaveBeenCalled();
  });
  it("does not initialize a removed player after its download completes", async () => {
    let resolve!: (plugin: PlayerstackPlugin) => void;
    const importer = vi.fn(
      () =>
        new Promise<PlayerstackPlugin>((r) => {
          resolve = r;
        }),
    );
    const sources = source();
    const plugins = createLazyPlugins(sources, importer);
    const ctx = context({ ctaEnd: { enabled: true } });
    const registry = createPluginRegistry();
    plugins.forEach((p) => registry.register(p));
    const initializing = registry.init(ctx);
    await vi.waitFor(() => expect(importer).toHaveBeenCalledTimes(1));
    registry.destroy();
    const init = vi.fn();
    resolve({ name: "cta-end", init });
    await initializing;
    expect(init).not.toHaveBeenCalled();
    expect(sources.init).not.toHaveBeenCalled();
  });
  it("allows each registered placeholder to initialize through the existing plugin interface", async () => {
    const plugin = { name: "cta-end", init: vi.fn(), destroy: vi.fn() };
    const importer = vi.fn().mockResolvedValue(plugin);
    const placeholder = createLazyPlugins(source(), importer).find((p) => p.name === "cta-end")!;
    const ctx = context({ ctaEnd: { enabled: true } });
    await placeholder.init(ctx);
    expect(importer).toHaveBeenCalledExactlyOnceWith("cta-end");
    expect(plugin.init.mock.calls[0]![0]).toBe(ctx);
    placeholder.destroy?.(ctx);
    expect(plugin.destroy.mock.calls[0]![0]).toBe(ctx);
  });
});
