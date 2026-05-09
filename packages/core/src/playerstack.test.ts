import { describe, expect, it, beforeEach, vi } from "vitest";
import { Playerstack, _resetForTesting } from "./playerstack";
import type { PlayerstackPlugin, PlayerstackContext } from "./plugins";

beforeEach(() => {
  _resetForTesting();
});

describe("Playerstack singleton API", () => {
  it("use() registers a plugin and returns Playerstack for chaining", () => {
    const plugin: PlayerstackPlugin = { name: "a", init: vi.fn() };
    const result = Playerstack.use(plugin);
    expect(result).toBe(Playerstack);
    expect(Playerstack.plugins().some((p) => p.name === "a")).toBe(true);
  });

  it("use() supports chaining multiple plugins", () => {
    const a: PlayerstackPlugin = { name: "a", init: vi.fn() };
    const b: PlayerstackPlugin = { name: "b", init: vi.fn() };
    Playerstack.use(a).use(b);
    expect(Playerstack.plugins().map((p) => p.name)).toEqual(["a", "b"]);
  });

  it("plugins() returns a readonly snapshot", () => {
    const a: PlayerstackPlugin = { name: "a", init: vi.fn() };
    Playerstack.use(a);
    const snapshot = Playerstack.plugins();
    expect(snapshot).toEqual([a]);
  });

  it("registers <player-stack> when define() is called", () => {
    expect(typeof Playerstack.define).toBe("function");
    Playerstack.define();
    expect(customElements.get("player-stack")).toBeDefined();
  });

  it("plugin's init() is invoked with a context containing config + mediaPlayer + events when element is connected", async () => {
    const initSpy = vi.fn();
    const plugin: PlayerstackPlugin = { name: "spy", init: initSpy };
    Playerstack.use(plugin);
    Playerstack.define();

    document.body.innerHTML = `<player-stack src="https://example.com/v.mp4" title="Test"></player-stack>`;
    const el = document.querySelector("player-stack") as HTMLElement;
    await waitForFrames(2);

    expect(initSpy).toHaveBeenCalledTimes(1);
    const ctx = initSpy.mock.calls[0]?.[0] as PlayerstackContext;
    expect(ctx.config.src).toBe("https://example.com/v.mp4");
    expect(ctx.config.title).toBe("Test");
    expect(ctx.events).toBeDefined();
    expect(typeof ctx.events.on).toBe("function");
    expect(ctx.container).toBe(el);
    expect(ctx.mediaPlayer.tagName.toLowerCase()).toBe("media-player");
  });

  it("emits a console error when no src is provided", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    Playerstack.define();
    document.body.innerHTML = `<player-stack></player-stack>`;
    await waitForFrames(2);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

async function waitForFrames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}
