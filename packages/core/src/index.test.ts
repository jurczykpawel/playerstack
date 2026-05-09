import { describe, expect, it } from "vitest";
import * as core from "./index";

describe("@playerstack/core public API", () => {
  it("exports the event bus factory", () => {
    expect(typeof core.createEventBus).toBe("function");
  });

  it("exports the plugin registry factory", () => {
    expect(typeof core.createPluginRegistry).toBe("function");
  });

  it("exports the inline config provider factory", () => {
    expect(typeof core.createInlineConfigProvider).toBe("function");
  });

  it("exports the custom element class and define helper", () => {
    expect(typeof core.PlayerstackElement).toBe("function");
    expect(typeof core.definePlayerstackElement).toBe("function");
  });

  it("auto-defines <player-stack> when imported in a DOM environment", () => {
    expect(customElements.get("player-stack")).toBeDefined();
  });

  it("exports the Playerstack singleton with use, plugins, define", () => {
    expect(core.Playerstack).toBeDefined();
    expect(typeof core.Playerstack.use).toBe("function");
    expect(typeof core.Playerstack.plugins).toBe("function");
    expect(typeof core.Playerstack.define).toBe("function");
  });
});
