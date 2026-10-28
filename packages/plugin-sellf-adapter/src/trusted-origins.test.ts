import { afterEach, expect, it, vi } from "vitest";
import { createSellfConfigProvider, type SellfAdapterOptions } from "./index";

afterEach(() => vi.unstubAllGlobals());

async function load(value: unknown, options: Partial<SellfAdapterOptions> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        src: "movie.mp4",
        emailGate: { enabled: true, webhookUrl: value, challengeUrl: value },
        analytics: { enabled: true, endpoint: value, provider: "console" },
        customCss: { trustedCss: "color:red" },
      }),
    ),
  );
  const element = document.createElement("div");
  element.setAttribute("data-sellf-product", "guide");
  return createSellfConfigProvider({ baseUrl: "https://sellf.app", ...options }).load(element);
}

it.each(["https://sellf.app/path?q=1", "https://SELLF.APP:443/path", "http://localhost:8080/lead"])(
  "accepts endpoints from an explicitly listed origin (%s)",
  async (value) => {
    const cfg = await load(value, {
      trustedOrigins: ["https://SELLF.APP:443/", "http://localhost:8080"],
    });
    expect(cfg.emailGate).toEqual({ enabled: true, webhookUrl: value, challengeUrl: value });
    expect(cfg.analytics).toEqual({ enabled: true, endpoint: value });
    expect(cfg.customCss).toEqual({});
  },
);

it.each([
  "https://other.app/lead",
  "javascript:alert(1)",
  "data:text/plain,x",
  "http://sellf.app/lead",
  "https://sellf.app:8443/lead",
  "https://sellf.app.evil.com/",
  "https://evil-sellf.app/",
  "https://sellf.app@evil.com/",
  "https://user:pass@sellf.app/",
  "https://@sellf.app/lead",
  "/lead",
  "//sellf.app/lead",
  42,
  null,
  {},
])("omits endpoints outside the listed origin (%j)", async (value) => {
  const cfg = await load(value, { trustedOrigins: ["https://sellf.app"] });
  expect(cfg.emailGate).toEqual({ enabled: true });
  expect(cfg.analytics).toEqual({ enabled: true });
});

it.each([
  "https://sellf.app/path",
  "https://sellf.app?x=1",
  "https://sellf.app#hash",
  "https://user:pass@sellf.app",
  "https://*.sellf.app",
  "ftp://sellf.app",
  "sellf.app",
  "/lead",
  "",
  "https://sellf.app/..",
  "https://sellf.app?",
  "https://sellf.app#",
  42,
  null,
])("validates each origin during construction (%j)", (value) => {
  expect(() =>
    createSellfConfigProvider({
      baseUrl: "https://sellf.app",
      trustedOrigins: [value] as string[],
    }),
  ).toThrow(/trustedOrigins/i);
});

it("validates the list even with trustRemote enabled", () => {
  expect(() =>
    createSellfConfigProvider({
      baseUrl: "https://sellf.app",
      trustRemote: true,
      trustedOrigins: ["invalid"],
    }),
  ).toThrow(/trustedOrigins/i);
});

it("keeps integrator endpoints first", async () => {
  const cfg = await load("https://sellf.app/remote", {
    trustedOrigins: ["https://sellf.app"],
    endpoints: {
      analytics: "/analytics",
      emailGate: { webhook: "/lead", challenge: "/challenge" },
    },
  });
  expect(cfg.analytics).toEqual({ enabled: true, endpoint: "/analytics" });
  expect(cfg.emailGate).toEqual({ enabled: true, webhookUrl: "/lead", challengeUrl: "/challenge" });
});

it("keeps remote endpoints omitted by default and with an empty list", async () => {
  for (const options of [{}, { trustedOrigins: [] }]) {
    const cfg = await load("https://sellf.app/lead", options);
    expect(cfg.emailGate).toEqual({ enabled: true });
    expect(cfg.analytics).toEqual({ enabled: true });
  }
});

it("preserves trustRemote passthrough when origins are also configured", async () => {
  const cfg = await load("https://other.app/lead", {
    trustRemote: true,
    trustedOrigins: ["https://sellf.app"],
  });
  expect(cfg.analytics).toEqual({
    enabled: true,
    endpoint: "https://other.app/lead",
    provider: "console",
  });
  expect(cfg.customCss).toEqual({ trustedCss: "color:red" });
});

it("snapshots the list at construction", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ src: "movie.mp4", analytics: { endpoint: "https://sellf.app/events" } }),
      ),
  );
  const trustedOrigins = ["https://sellf.app"];
  const provider = createSellfConfigProvider({ baseUrl: "https://sellf.app", trustedOrigins });
  trustedOrigins.length = 0;
  const element = document.createElement("div");
  element.setAttribute("data-sellf-product", "guide");
  expect((await provider.load(element)).analytics).toEqual({
    endpoint: "https://sellf.app/events",
  });
});

it.each([null, "https://sellf.app", {}])("requires an array of origins (%j)", (trustedOrigins) => {
  expect(() =>
    createSellfConfigProvider({
      baseUrl: "https://sellf.app",
      trustedOrigins: trustedOrigins as unknown as string[],
    }),
  ).toThrow(/trustedOrigins/);
});
