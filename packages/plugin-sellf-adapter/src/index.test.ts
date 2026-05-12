import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSellfConfigProvider } from "./index";

function el(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html.trim();
  return div.firstElementChild as HTMLElement;
}

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

describe("createSellfConfigProvider", () => {
  it("has the name 'sellf'", () => {
    const provider = createSellfConfigProvider({ baseUrl: "https://sellf.app" });
    expect(provider.name).toBe("sellf");
  });

  it("fetches /api/products/:id/playerstack and returns the JSON config", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ src: "https://cdn.example.com/v.mp4", title: "Sellf product" }),
    });
    const provider = createSellfConfigProvider({ baseUrl: "https://sellf.app" });
    const cfg = await provider.load(
      el(`<player-stack data-sellf-product="abc123"></player-stack>`),
    );
    expect(cfg.src).toBe("https://cdn.example.com/v.mp4");
    expect(cfg.title).toBe("Sellf product");
    expect(globalThis.fetch).toHaveBeenCalled();
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
      "https://sellf.app/api/products/abc123/playerstack",
    );
  });

  it("falls back to inline attributes when data-sellf-product is missing", async () => {
    const provider = createSellfConfigProvider({ baseUrl: "https://sellf.app" });
    const cfg = await provider.load(
      el(`<player-stack src="https://example.com/v.mp4" title="inline"></player-stack>`),
    );
    expect(cfg.src).toBe("https://example.com/v.mp4");
    expect(cfg.title).toBe("inline");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("merges inline attributes over fetched config (inline wins for src)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ src: "from-sellf.mp4", title: "from sellf" }),
    });
    const provider = createSellfConfigProvider({ baseUrl: "https://sellf.app" });
    const cfg = await provider.load(
      el(`<player-stack data-sellf-product="abc" src="inline.mp4"></player-stack>`),
    );
    expect(cfg.src).toBe("inline.mp4");
    expect(cfg.title).toBe("from sellf");
  });

  it("throws a clear error when Sellf endpoint returns non-OK", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    const provider = createSellfConfigProvider({ baseUrl: "https://sellf.app" });
    await expect(
      provider.load(el(`<player-stack data-sellf-product="missing"></player-stack>`)),
    ).rejects.toThrow(/sellf|404/i);
  });

  it("validates that fetched config has a src field", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ title: "no src here" }),
    });
    const provider = createSellfConfigProvider({ baseUrl: "https://sellf.app" });
    await expect(
      provider.load(el(`<player-stack data-sellf-product="abc"></player-stack>`)),
    ).rejects.toThrow(/src/i);
  });

  it("drops customCss.trustedCss / .css / .acknowledgeTrusted from the API response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        src: "https://cdn.example.com/v.mp4",
        customCss: {
          enabled: true,
          tokens: { "--ps-accent": "#008aff" },
          trustedCss: "& video { filter: invert(1); }",
          css: "border: 1px solid red;",
          acknowledgeTrusted: true,
        },
      }),
    });
    const provider = createSellfConfigProvider({ baseUrl: "https://sellf.app" });
    const cfg = (await provider.load(
      el(`<player-stack data-sellf-product="x"></player-stack>`),
    )) as Record<string, unknown>;
    expect(cfg.customCss).toEqual({ enabled: true, tokens: { "--ps-accent": "#008aff" } });
  });

  it("drops actionBar.html / ctaEnd.html / introCard.html from the API response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        src: "https://cdn.example.com/v.mp4",
        actionBar: { enabled: true, title: "ok", html: "<script>x()</script>" },
        ctaEnd: { enabled: true, html: "<img onerror=x()>" },
        introCard: { enabled: true, html: "<iframe></iframe>" },
      }),
    });
    const provider = createSellfConfigProvider({ baseUrl: "https://sellf.app" });
    const cfg = (await provider.load(
      el(`<player-stack data-sellf-product="x"></player-stack>`),
    )) as Record<string, unknown>;
    expect(cfg.actionBar).toEqual({ enabled: true, title: "ok" });
    expect(cfg.ctaEnd).toEqual({ enabled: true });
    expect(cfg.introCard).toEqual({ enabled: true });
  });

  it("overrides analytics.endpoint with options.endpoints.analytics regardless of remote value", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        src: "https://cdn.example.com/v.mp4",
        analytics: { enabled: true, endpoint: "https://attacker.example/track", debug: true },
      }),
    });
    const provider = createSellfConfigProvider({
      baseUrl: "https://sellf.app",
      endpoints: { analytics: "https://sellf.app/track" },
    });
    const cfg = (await provider.load(
      el(`<player-stack data-sellf-product="x"></player-stack>`),
    )) as Record<string, unknown>;
    expect(cfg.analytics).toEqual({
      enabled: true,
      debug: true,
      endpoint: "https://sellf.app/track",
    });
  });

  it("overrides emailGate URLs with options.endpoints.emailGate regardless of remote value", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        src: "https://cdn.example.com/v.mp4",
        emailGate: {
          enabled: true,
          title: "Watch more",
          webhookUrl: "https://attacker.example/lead",
          challengeUrl: "https://attacker.example/c",
        },
      }),
    });
    const provider = createSellfConfigProvider({
      baseUrl: "https://sellf.app",
      endpoints: {
        emailGate: {
          webhook: "https://sellf.app/leads/submit",
          challenge: "https://sellf.app/leads/challenge",
        },
      },
    });
    const cfg = (await provider.load(
      el(`<player-stack data-sellf-product="x"></player-stack>`),
    )) as Record<string, unknown>;
    expect(cfg.emailGate).toEqual({
      enabled: true,
      title: "Watch more",
      webhookUrl: "https://sellf.app/leads/submit",
      challengeUrl: "https://sellf.app/leads/challenge",
    });
  });

  it("trustRemote: true passes the API response through without normalization", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        src: "https://cdn.example.com/v.mp4",
        customCss: { enabled: true, trustedCss: "x", acknowledgeTrusted: true },
        unknownField: "kept",
      }),
    });
    const provider = createSellfConfigProvider({
      baseUrl: "https://sellf.app",
      trustRemote: true,
    });
    const cfg = (await provider.load(
      el(`<player-stack data-sellf-product="x"></player-stack>`),
    )) as Record<string, unknown>;
    expect((cfg.customCss as Record<string, unknown>).trustedCss).toBe("x");
    expect(cfg.unknownField).toBe("kept");
  });
});
