import { describe, expect, it, vi } from "vitest";
import { createPluginRegistry } from "./plugins";
import type { PlayerstackPlugin, PlayerstackContext } from "./plugins";

function fakeContext(): PlayerstackContext {
  return {} as PlayerstackContext;
}

function plugin(name: string, overrides: Partial<PlayerstackPlugin> = {}): PlayerstackPlugin {
  return {
    name,
    init: vi.fn(),
    ...overrides,
  };
}

describe("createPluginRegistry", () => {
  it("returns an object with register, list, init, destroy functions", () => {
    const reg = createPluginRegistry();
    expect(typeof reg.register).toBe("function");
    expect(typeof reg.list).toBe("function");
    expect(typeof reg.init).toBe("function");
    expect(typeof reg.destroy).toBe("function");
  });

  it("starts with an empty plugin list", () => {
    const reg = createPluginRegistry();
    expect(reg.list()).toEqual([]);
  });

  it("register adds a plugin and list returns it", () => {
    const reg = createPluginRegistry();
    const p = plugin("a");
    reg.register(p);
    expect(reg.list()).toEqual([p]);
  });

  it("registering two plugins with the same name throws", () => {
    const reg = createPluginRegistry();
    reg.register(plugin("dup"));
    expect(() => reg.register(plugin("dup"))).toThrow(/dup/);
  });

  it("init calls each plugin.init in registration order with the same context", async () => {
    const reg = createPluginRegistry();
    const order: string[] = [];
    const ctx = fakeContext();

    reg.register({
      name: "first",
      init: (c) => {
        order.push("first");
        expect(c).toBe(ctx);
      },
    });
    reg.register({
      name: "second",
      init: (c) => {
        order.push("second");
        expect(c).toBe(ctx);
      },
    });

    await reg.init(ctx);
    expect(order).toEqual(["first", "second"]);
  });

  it("init awaits async plugin.init before moving to the next plugin", async () => {
    const reg = createPluginRegistry();
    const order: string[] = [];

    reg.register({
      name: "slow",
      init: async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push("slow");
      },
    });
    reg.register({
      name: "fast",
      init: () => {
        order.push("fast");
      },
    });

    await reg.init(fakeContext());
    expect(order).toEqual(["slow", "fast"]);
  });

  it("destroy calls plugin.destroy in reverse registration order", async () => {
    const reg = createPluginRegistry();
    const order: string[] = [];

    reg.register({
      name: "a",
      init: () => {},
      destroy: () => {
        order.push("a");
      },
    });
    reg.register({
      name: "b",
      init: () => {},
      destroy: () => {
        order.push("b");
      },
    });

    await reg.init(fakeContext());
    reg.destroy();
    expect(order).toEqual(["b", "a"]);
  });

  it("destroy ignores plugins that did not define destroy", async () => {
    const reg = createPluginRegistry();
    reg.register({ name: "no-destroy", init: () => {} });
    await reg.init(fakeContext());
    expect(() => reg.destroy()).not.toThrow();
  });

  it("destroy isolates errors so all plugins get their destroy called", async () => {
    const reg = createPluginRegistry();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const aDestroy = vi.fn(() => {
      throw new Error("a-fail");
    });
    const bDestroy = vi.fn();

    reg.register({ name: "a", init: () => {}, destroy: aDestroy });
    reg.register({ name: "b", init: () => {}, destroy: bDestroy });

    await reg.init(fakeContext());
    reg.destroy();

    expect(aDestroy).toHaveBeenCalled();
    expect(bDestroy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("init throws when called twice without destroy in between", async () => {
    const reg = createPluginRegistry();
    reg.register(plugin("a"));
    await reg.init(fakeContext());
    await expect(reg.init(fakeContext())).rejects.toThrow(/already/i);
  });
});
