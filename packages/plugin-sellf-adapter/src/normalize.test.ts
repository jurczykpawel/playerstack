import { describe, expect, it } from "vitest";
import { normalizeRemoteConfig } from "./normalize";

describe("normalizeRemoteConfig", () => {
  it("returns an empty object for non-object input", () => {
    expect(normalizeRemoteConfig(null)).toEqual({});
    expect(normalizeRemoteConfig(undefined)).toEqual({});
    expect(normalizeRemoteConfig("string")).toEqual({});
    expect(normalizeRemoteConfig(42)).toEqual({});
    expect(normalizeRemoteConfig([])).toEqual({});
  });

  it("keeps documented top-level string fields", () => {
    expect(
      normalizeRemoteConfig({
        src: "https://example.com/v.mp4",
        poster: "https://example.com/p.jpg",
        title: "Hello",
      }),
    ).toEqual({
      src: "https://example.com/v.mp4",
      poster: "https://example.com/p.jpg",
      title: "Hello",
    });
  });

  it("keeps `crossorigin` only when set to a recognized value", () => {
    expect(normalizeRemoteConfig({ crossorigin: "anonymous" })).toEqual({
      crossorigin: "anonymous",
    });
    expect(normalizeRemoteConfig({ crossorigin: "use-credentials" })).toEqual({
      crossorigin: "use-credentials",
    });
    expect(normalizeRemoteConfig({ crossorigin: "weird" })).toEqual({});
  });

  it("drops unknown top-level keys", () => {
    const out = normalizeRemoteConfig({
      src: "https://example.com/v.mp4",
      __secretFlag: true,
      foo: "bar",
    });
    expect(out).toEqual({ src: "https://example.com/v.mp4" });
  });

  describe("customCss", () => {
    it("keeps `enabled` and validated `tokens`", () => {
      expect(
        normalizeRemoteConfig({
          customCss: {
            enabled: true,
            tokens: { "--ps-accent": "#008aff", "--ps-radius": "8px" },
          },
        }),
      ).toEqual({
        customCss: {
          enabled: true,
          tokens: { "--ps-accent": "#008aff", "--ps-radius": "8px" },
        },
      });
    });

    it("drops trustedCss, css, and acknowledgeTrusted from the API response", () => {
      expect(
        normalizeRemoteConfig({
          customCss: {
            enabled: true,
            tokens: { "--ps-accent": "#008aff" },
            trustedCss: "& video { filter: invert(1); }",
            css: "border: 1px solid red;",
            acknowledgeTrusted: true,
          },
        }),
      ).toEqual({
        customCss: {
          enabled: true,
          tokens: { "--ps-accent": "#008aff" },
        },
      });
    });

    it("drops non-string token values", () => {
      expect(
        normalizeRemoteConfig({
          customCss: {
            tokens: { "--ps-accent": "#008aff", "--ps-bad": 42, "--ps-nope": null },
          },
        }),
      ).toEqual({
        customCss: { tokens: { "--ps-accent": "#008aff" } },
      });
    });
  });

  describe("actionBar / ctaEnd / introCard", () => {
    it("drops the `html` field from each", () => {
      const out = normalizeRemoteConfig({
        actionBar: { enabled: true, title: "ok", html: "<script>x()</script>" },
        ctaEnd: { enabled: true, title: "Done", html: "<img onerror=x()>" },
        introCard: { enabled: true, badge: "FREE", html: "<iframe src=x></iframe>" },
      });
      expect(out.actionBar).toEqual({ enabled: true, title: "ok" });
      expect(out.ctaEnd).toEqual({ enabled: true, title: "Done" });
      expect(out.introCard).toEqual({ enabled: true, badge: "FREE" });
    });

    it("keeps CTA button label/url/utm", () => {
      const out = normalizeRemoteConfig({
        ctaEnd: {
          enabled: true,
          button: { label: "Buy", url: "https://example.com/buy", utm: "utm_source=x" },
        },
      });
      expect(out.ctaEnd).toEqual({
        enabled: true,
        button: { label: "Buy", url: "https://example.com/buy", utm: "utm_source=x" },
      });
    });

    it("strips unknown sub-keys on CTA buttons", () => {
      const out = normalizeRemoteConfig({
        ctaEnd: {
          button: { label: "Buy", url: "https://example.com", evil: "<script>x()</script>" },
        },
      });
      expect((out.ctaEnd as { button: Record<string, unknown> }).button).toEqual({
        label: "Buy",
        url: "https://example.com",
      });
    });
  });

  describe("analytics", () => {
    it("drops `endpoint` and `provider`; keeps enabled/debug/customProps", () => {
      const out = normalizeRemoteConfig({
        analytics: {
          enabled: true,
          debug: false,
          endpoint: "https://attacker.example/track",
          provider: "console",
          customProps: { courseId: "abc", deep: { nope: true } },
          forwardBusEvents: ["thumb:click"],
        },
      });
      expect(out.analytics).toEqual({
        enabled: true,
        debug: false,
        forwardBusEvents: ["thumb:click"],
        customProps: { courseId: "abc" },
      });
    });

    it("keeps quartiles when boolean or a clean number array; rejects garbage entries", () => {
      const passBool = normalizeRemoteConfig({ analytics: { quartiles: false } });
      expect((passBool.analytics as Record<string, unknown>).quartiles).toBe(false);

      const passArr = normalizeRemoteConfig({
        analytics: { quartiles: [10, 50, 90, 150, -5, "75", 100] },
      });
      expect((passArr.analytics as Record<string, unknown>).quartiles).toEqual([10, 50, 90, 100]);

      const empty = normalizeRemoteConfig({ analytics: { quartiles: ["nope", -1] } });
      expect((empty.analytics as Record<string, unknown>).quartiles).toBeUndefined();

      const bogus = normalizeRemoteConfig({ analytics: { quartiles: "all" } });
      expect((bogus.analytics as Record<string, unknown>).quartiles).toBeUndefined();
    });
  });

  describe("emailGate", () => {
    it("drops webhookUrl and challengeUrl; keeps presentation fields", () => {
      const out = normalizeRemoteConfig({
        emailGate: {
          enabled: true,
          at: "before",
          title: "Watch the rest",
          buttonLabel: "Continue",
          webhookUrl: "https://attacker.example/lead",
          challengeUrl: "https://attacker.example/c",
        },
      });
      expect(out.emailGate).toEqual({
        enabled: true,
        at: "before",
        title: "Watch the rest",
        buttonLabel: "Continue",
      });
    });
  });

  describe("watermark", () => {
    it("keeps documented fields (URL validation happens later in the plugin)", () => {
      const out = normalizeRemoteConfig({
        watermark: {
          enabled: true,
          src: "https://example.com/logo.png",
          href: "https://example.com",
          position: "top-right",
          opacity: 0.8,
          width: 120,
        },
      });
      expect(out.watermark).toEqual({
        enabled: true,
        src: "https://example.com/logo.png",
        href: "https://example.com",
        position: "top-right",
        opacity: 0.8,
        width: 120,
      });
    });
  });

  describe("twitch", () => {
    it("keeps parent as string or string[]", () => {
      expect(normalizeRemoteConfig({ twitch: { parent: "example.com" } })).toEqual({
        twitch: { parent: "example.com" },
      });
      expect(normalizeRemoteConfig({ twitch: { parent: ["a.com", "b.com"] } })).toEqual({
        twitch: { parent: ["a.com", "b.com"] },
      });
    });

    it("drops parent when not a string or string array", () => {
      expect(normalizeRemoteConfig({ twitch: { parent: 42 } })).toEqual({ twitch: {} });
      expect(normalizeRemoteConfig({ twitch: { parent: ["a", 1] } })).toEqual({ twitch: {} });
    });
  });

  it("does not mutate the input object", () => {
    const input = {
      src: "https://example.com/v.mp4",
      customCss: { enabled: true, trustedCss: "x" },
    };
    const before = JSON.stringify(input);
    normalizeRemoteConfig(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
