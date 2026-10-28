import { afterEach, expect, it, vi } from "vitest";
import { createEventBus, type PlayerstackContext } from "@playerstack/core";
import { emailGatePlugin } from "../../plugin-email-gate/src/index";
import { createSellfConfigProvider } from "./index";
import { normalizeRemoteConfig } from "./normalize";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it("carries the product form from the API through the adapter to submission", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        src: "movie.mp4",
        emailGate: {
          enabled: true,
          at: "after",
          product: " guide ",
          remember: false,
          altchaFormat: "base64",
          dismissible: true,
          marketingConsent: { text: "Send updates", version: "v1", required: true },
          privacy: { text: "Privacy notice", href: "/privacy", linkText: "Policy" },
          messages: {
            title: "Get the guide",
            submit: "Send",
            consentRequired: "Select consent",
            success: "Check email",
          },
          webhookUrl: "https://remote.example/lead",
          challengeUrl: "https://remote.example/challenge",
        },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        nonce: "nonce",
        altcha: {
          algorithm: "SHA-256",
          challenge: "590c9f8430c7435807df8ba9a476e3f1295d46ef210f6efae2043a4c085a569e",
          salt: "test",
          signature: "signature",
          maxnumber: 0,
        },
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetcher);
  const element = document.createElement("div");
  element.setAttribute("data-sellf-product", "guide");
  const config = await createSellfConfigProvider({
    baseUrl: "https://sellf.example",
    endpoints: {
      emailGate: {
        webhook: "https://sellf.example/lead",
        challenge: "https://sellf.example/challenge",
      },
    },
  }).load(element);
  expect(fetcher.mock.calls[0]![0]).toBe("https://sellf.example/api/products/guide/playerstack");
  expect(config.emailGate).toMatchObject({
    at: "after",
    product: "guide",
    altchaFormat: "base64",
    remember: false,
  });
  const container = document.createElement("div");
  document.body.append(container);
  const mediaPlayer = Object.assign(document.createElement("video"), {
    pause: vi.fn(),
    play: vi.fn(),
  });
  container.append(mediaPlayer);
  const ctx = {
    container,
    mediaPlayer,
    config,
    events: createEventBus(),
  } as unknown as PlayerstackContext;
  try {
    await emailGatePlugin.init(ctx);
    expect(container.querySelector("form")).toBeNull();
    mediaPlayer.dispatchEvent(new Event("ended"));
    await vi.waitFor(() => expect(container.querySelector("form")).not.toBeNull());
    expect(container.textContent).toContain("Get the guide");
    expect(container.textContent).toContain("Privacy notice");
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.required).toBe(true);
    expect(checkbox.checked).toBe(false);
    container.querySelector<HTMLInputElement>('input[type="email"]')!.value = "viewer@example.com";
    const send = () =>
      container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    send();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Select consent");
    checkbox.checked = true;
    send();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(fetcher.mock.calls[1]![0]).toBe("https://sellf.example/challenge?product=guide");
    expect(fetcher.mock.calls[2]![0]).toBe("https://sellf.example/lead");
    const body = JSON.parse(fetcher.mock.calls[2]![1].body);
    expect(body).toMatchObject({
      product: "guide",
      marketingConsent: true,
      consentVersion: "v1",
      consentText: "Send updates",
      nonce: "nonce",
    });
    expect(JSON.parse(atob(body.altcha))).toMatchObject({ number: 0 });
    await vi.waitFor(() => expect(container.textContent).toContain("Check email"));
  } finally {
    emailGatePlugin.destroy?.(ctx);
  }
});

it("keeps bounded known fields and fresh nested objects", () => {
  const emailGate = {
    product: "x".repeat(100),
    at: 0,
    atPercent: 100,
    rememberDays: 0,
    dismissible: false,
    remember: true,
    altchaFormat: "object",
    title: "t".repeat(500),
    buttonLabel: "b".repeat(500),
    storageKey: "k".repeat(200),
    marketingConsent: {
      text: "t".repeat(500),
      version: "v".repeat(64),
      required: false,
      linkText: "l".repeat(200),
      href: "/privacy",
    },
    privacy: { text: "p".repeat(500), linkText: "Policy", href: "https://example.com/privacy" },
    messages: Object.fromEntries(
      [
        "title",
        "emailLabel",
        "placeholder",
        "submit",
        "verifying",
        "solving",
        "submitting",
        "success",
        "invalidEmail",
        "rejected",
        "rateLimit",
        "networkError",
        "dismiss",
        "consentRequired",
      ].map((key) => [key, "m".repeat(500)]),
    ),
  };
  const out = normalizeRemoteConfig({ emailGate }).emailGate as typeof emailGate;
  expect(out).toEqual(emailGate);
  expect(out.messages).not.toBe(emailGate.messages);
  expect(out.marketingConsent).not.toBe(emailGate.marketingConsent);
});

it.each([
  { product: " ", marketingConsent: { text: "ok" }, privacy: { text: " " } },
  { product: 42, marketingConsent: { text: 3, version: "v" }, privacy: [] },
  { product: "x".repeat(101), marketingConsent: { text: "x".repeat(501), version: "v" } },
  { marketingConsent: { text: "ok", version: "v".repeat(65) } },
  { marketingConsent: { text: "ok", version: " " } },
  { marketingConsent: null },
  { at: -1, atPercent: 101, rememberDays: -1 },
  { at: Infinity, atPercent: NaN, rememberDays: Infinity },
  {
    at: "later",
    atPercent: "50",
    rememberDays: "30",
    dismissible: 1,
    remember: "false",
    altchaFormat: "json",
  },
  { title: "t".repeat(501), buttonLabel: false, storageKey: "k".repeat(201) },
])("drops invalid fields (%j)", (emailGate) => {
  expect(normalizeRemoteConfig({ emailGate }).emailGate).toEqual({});
});

it("filters nested fields and unsupported link protocols", () => {
  expect(
    normalizeRemoteConfig({
      emailGate: {
        marketingConsent: {
          text: " Text ",
          version: "v",
          required: "true",
          unknown: true,
          href: "javascript:alert(1)",
          linkText: "l".repeat(201),
        },
        privacy: { text: "Notice", unknown: 1, href: "data:text/plain,x", linkText: "Policy" },
        messages: { success: "ok", title: 42, submit: "x".repeat(501), unknown: "value" },
        webhookUrl: "https://remote.example",
        challengeUrl: "https://remote.example",
        unknown: true,
      },
    }).emailGate,
  ).toEqual({
    marketingConsent: { text: " Text ", version: "v" },
    privacy: { text: "Notice", linkText: "Policy" },
    messages: { success: "ok" },
  });
});

it.each(["/privacy", "../privacy", "https://example.com", "http://example.com"])(
  "accepts an HTTP or relative link %s",
  (href) => {
    expect(
      normalizeRemoteConfig({ emailGate: { privacy: { text: "Notice", href } } }).emailGate,
    ).toEqual({ privacy: { text: "Notice", href } });
  },
);
