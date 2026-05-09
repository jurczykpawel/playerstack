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
    const cfg = await provider.load(el(`<player-stack data-sellf-product="abc123"></player-stack>`));
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
});
