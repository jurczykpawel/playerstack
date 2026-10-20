// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScriptPluginImporter } from "./script-plugin-imports";
import { pluginModules } from "./plugin-modules";

let appended: HTMLScriptElement[] = [];
beforeEach(() => {
  appended = [];
  vi.spyOn(document.head, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
    const script = node as unknown as HTMLScriptElement;
    script.remove = () => {
      appended = appended.filter((item) => item !== script);
    };
    appended.push(script);
    return node;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  pluginModules().clear();
  vi.useRealTimers();
});

function loader() {
  return createScriptPluginImporter({
    base: "https://cdn.example/assets/",
    files: { "cta-end": "playerstack-plugin-cta-end.js?v=12345678" },
    document,
  });
}

describe("standalone plugin scripts", () => {
  it("resolves the plugin registered under the full versioned sibling URL", async () => {
    const pending = loader()("cta-end");
    const script = appended[0]!;
    expect(script.src).toBe("https://cdn.example/assets/playerstack-plugin-cta-end.js?v=12345678");
    const plugin = { name: "cta-end", init() {} };
    pluginModules().set(script.src, plugin);
    script.dispatchEvent(new Event("load"));
    expect(await pending).toBe(plugin);
  });

  it("rejects and removes a failed script", async () => {
    const pending = loader()("cta-end");
    const rejected = expect(pending).rejects.toThrow(/failed to load/);
    appended[0]!.dispatchEvent(new Event("error"));
    await rejected;
    expect(appended).toHaveLength(0);
  });

  it("rejects a loaded file that did not register the expected plugin", async () => {
    const pending = loader()("cta-end");
    const rejected = expect(pending).rejects.toThrow(/did not register cta-end/);
    appended[0]!.dispatchEvent(new Event("load"));
    await rejected;
  });

  it("bounds download time so playback can recover from a stalled request", async () => {
    vi.useFakeTimers();
    const pending = loader()("cta-end");
    const rejected = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    expect(appended).toHaveLength(0);
  });
});
