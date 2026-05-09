import { describe, expect, it } from "vitest";
import { createInlineConfigProvider } from "./config";
import type { PlayerstackConfig } from "./config";

function el(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html.trim();
  return div.firstElementChild as HTMLElement;
}

describe("createInlineConfigProvider", () => {
  it("returns a provider with name and load function", () => {
    const provider = createInlineConfigProvider();
    expect(provider.name).toBe("inline");
    expect(typeof provider.load).toBe("function");
  });

  it("reads src from a plain src attribute", async () => {
    const provider = createInlineConfigProvider();
    const config = await provider.load(
      el(`<player-stack src="https://example.com/v.mp4"></player-stack>`),
    );
    expect(config.src).toBe("https://example.com/v.mp4");
  });

  it("reads poster and title from attributes", async () => {
    const provider = createInlineConfigProvider();
    const config = await provider.load(
      el(`<player-stack src="x.mp4" poster="p.png" title="Demo"></player-stack>`),
    );
    expect(config.poster).toBe("p.png");
    expect(config.title).toBe("Demo");
  });

  it("merges JSON from data-config with attributes (data-config wins)", async () => {
    const provider = createInlineConfigProvider();
    const config = await provider.load(
      el(
        `<player-stack src="from-attr.mp4" data-config='{"src":"from-json.mp4","title":"JSON title"}'></player-stack>`,
      ),
    );
    expect(config.src).toBe("from-json.mp4");
    expect(config.title).toBe("JSON title");
  });

  it("uses attribute src when data-config does not specify src", async () => {
    const provider = createInlineConfigProvider();
    const config = await provider.load(
      el(`<player-stack src="from-attr.mp4" data-config='{"title":"hello"}'></player-stack>`),
    );
    expect(config.src).toBe("from-attr.mp4");
    expect(config.title).toBe("hello");
  });

  it("throws a clear error when src is missing", async () => {
    const provider = createInlineConfigProvider();
    await expect(provider.load(el(`<player-stack></player-stack>`))).rejects.toThrow(/src/i);
  });

  it("throws a clear error when src is empty string", async () => {
    const provider = createInlineConfigProvider();
    await expect(provider.load(el(`<player-stack src=""></player-stack>`))).rejects.toThrow(/src/i);
  });

  it("throws a JSON parse error mentioning data-config", async () => {
    const provider = createInlineConfigProvider();
    await expect(
      provider.load(el(`<player-stack src="x.mp4" data-config='{not json}'></player-stack>`)),
    ).rejects.toThrow(/data-config/i);
  });

  it("throws when data-config is not an object (e.g. a JSON array or string)", async () => {
    const provider = createInlineConfigProvider();
    await expect(
      provider.load(el(`<player-stack src="x.mp4" data-config='["a","b"]'></player-stack>`)),
    ).rejects.toThrow(/object/i);
  });

  it("returns a config conforming to PlayerstackConfig shape (src is string)", async () => {
    const provider = createInlineConfigProvider();
    const config: PlayerstackConfig = await provider.load(
      el(`<player-stack src="x.mp4"></player-stack>`),
    );
    expect(typeof config.src).toBe("string");
  });
});
