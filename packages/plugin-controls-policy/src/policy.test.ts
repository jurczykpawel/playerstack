import { describe, expect, it } from "vitest";
import { buildPolicy, ALL_CONTROLS, type ControlsPolicyConfig } from "./policy";

describe("buildPolicy", () => {
  it("returns empty vars and empty hideCss for empty config", () => {
    const result = buildPolicy({});
    expect(result.vars).toEqual({});
    expect(result.hideCss).toBe("");
  });

  it("emits --ps-accent, --media-brand, --video-brand when accent is set", () => {
    const result = buildPolicy({ accent: "#ff00aa" });
    expect(result.vars["--ps-accent"]).toBe("#ff00aa");
    expect(result.vars["--media-brand"]).toBe("#ff00aa");
    expect(result.vars["--video-brand"]).toBe("#ff00aa");
  });

  it("emits --ps-bg-opacity for valid opacity", () => {
    expect(buildPolicy({ bgOpacity: 0.5 }).vars["--ps-bg-opacity"]).toBe("0.5");
  });

  it("clamps bgOpacity to [0..1]", () => {
    expect(buildPolicy({ bgOpacity: 1.5 }).vars["--ps-bg-opacity"]).toBe("1");
    expect(buildPolicy({ bgOpacity: -0.2 }).vars["--ps-bg-opacity"]).toBe("0");
  });

  it("hide CSS lists controls not in show whitelist", () => {
    const result = buildPolicy({ show: ["play", "progress"] });
    expect(result.hideCss).toContain("media-volume-range");
    expect(result.hideCss).toContain("media-fullscreen-button");
    expect(result.hideCss).toContain("display: none");
    expect(result.hideCss).not.toMatch(/media-play-button[^}]*display:\s*none/);
  });

  it("emits no hide rules when show whitelist contains all controls", () => {
    const result = buildPolicy({ show: [...ALL_CONTROLS] });
    expect(result.hideCss).toBe("");
  });

  it("ignores unknown control names in show list", () => {
    const result = buildPolicy({ show: ["play", "unknown-thing"] as never });
    expect(result.hideCss).toContain("media-volume-range");
  });

  it("rejects accent values that look like CSS injection", () => {
    const result = buildPolicy({ accent: "red; } body { display: none; /*" });
    expect(result.vars["--ps-accent"]).toBeUndefined();
  });

  it("combines vars and hideCss without interference", () => {
    const result = buildPolicy({
      show: ["play", "progress"],
      accent: "#008aff",
      bgOpacity: 0.8,
    });
    expect(result.vars["--ps-accent"]).toBe("#008aff");
    expect(result.vars["--media-brand"]).toBe("#008aff");
    expect(result.vars["--ps-bg-opacity"]).toBe("0.8");
    expect(result.hideCss).toContain("media-volume-range");
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
