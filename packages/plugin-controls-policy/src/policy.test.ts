import { describe, expect, it } from "vitest";
import { buildPolicyCss, type ControlsPolicyConfig, ALL_CONTROLS } from "./policy";

describe("buildPolicyCss", () => {
  it("returns empty string for empty config", () => {
    expect(buildPolicyCss({})).toBe("");
  });

  it("emits --ps-accent CSS variable when accent is set", () => {
    const css = buildPolicyCss({ accent: "#ff00aa" });
    expect(css).toContain("--ps-accent: #ff00aa");
    expect(css).toContain(":host");
  });

  it("emits --ps-bg-opacity CSS variable when bgOpacity is set", () => {
    const css = buildPolicyCss({ bgOpacity: 0.5 });
    expect(css).toContain("--ps-bg-opacity: 0.5");
  });

  it("hides controls not in show list (via display:none on media-* elements)", () => {
    const css = buildPolicyCss({ show: ["play", "progress"] });
    // hidden controls should appear with display: none
    expect(css).toContain("media-volume-slider");
    expect(css).toContain("media-fullscreen-button");
    expect(css).toContain("display: none");
    // play and progress should NOT appear in hidden list
    expect(css).not.toMatch(/media-play-button[^}]*display:\s*none/);
  });

  it("does not produce hide rules when show list contains all known controls", () => {
    const allControls = [...ALL_CONTROLS];
    const css = buildPolicyCss({ show: allControls });
    expect(css).not.toContain("display: none");
  });

  it("ignores unknown control names in show list", () => {
    const css = buildPolicyCss({ show: ["play", "unknown-thing"] as never });
    // should not throw, and should still hide the rest
    expect(css).toContain("media-volume-slider");
  });

  it("escapes accent value to prevent CSS injection", () => {
    const css = buildPolicyCss({ accent: "red; } body { display: none; /*" });
    // dangerous chars should be stripped or quoted; no raw closing brace before our brace
    expect(css).not.toContain("body { display: none");
  });

  it("escapes bgOpacity to a numeric range [0..1]", () => {
    expect(buildPolicyCss({ bgOpacity: 1.5 })).toContain("--ps-bg-opacity: 1");
    expect(buildPolicyCss({ bgOpacity: -0.2 })).toContain("--ps-bg-opacity: 0");
  });

  it("combines all options without overlap", () => {
    const css = buildPolicyCss({
      show: ["play", "progress"],
      accent: "#008aff",
      bgOpacity: 0.8,
    });
    expect(css).toContain("--ps-accent: #008aff");
    expect(css).toContain("--ps-bg-opacity: 0.8");
    expect(css).toContain("media-volume-slider");
  });
});

describe("ALL_CONTROLS", () => {
  it("lists the supported control names", () => {
    expect(ALL_CONTROLS).toEqual(
      expect.arrayContaining(["play", "progress", "time", "volume", "fullscreen", "speed"]),
    );
  });
});

describe("ControlsPolicyConfig type shape", () => {
  it("accepts the documented shape", () => {
    const cfg: ControlsPolicyConfig = {
      show: ["play"],
      accent: "#fff",
      bgOpacity: 0.5,
    };
    expect(cfg.show).toBeDefined();
  });
});
