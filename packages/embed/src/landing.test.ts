import { describe, expect, it } from "vitest";
import { en } from "../../../apps/docs/src/content/landing";
import type { EmailGateConfig } from "@playerstack/plugin-email-gate";

describe("landing email form example", () => {
  it("demonstrates a typed after-video form and drives the end event", () => {
    const step = en.livingDemo.steps.find((item) => item.key === "email-gate")!;
    const config = step.config.emailGate as EmailGateConfig;
    expect(config.at).toBe("after");
    expect(config.enabled).toBe(true);
    expect(step.action).toBe("end");
    expect(step.code.map((line) => line.text).join("\n")).toContain('"at": "after"');
  });
  it("describes both timing choices and uninterrupted after-video playback", () => {
    const step = en.livingDemo.steps.find((item) => item.key === "email-gate")!;
    expect(step.blurb).toMatch(/before/i);
    expect(step.blurb).toMatch(/after/i);
    expect(step.blurb).toMatch(/full video|uninterrupted|without interrupting/i);
    const plugin = en.plugins.groups
      .flatMap((group) => group.items)
      .find((item) => item.pkg === "email-gate")!;
    expect(plugin.desc).toMatch(/before/i);
    expect(plugin.desc).toMatch(/after/i);
  });
});
