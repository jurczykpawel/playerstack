import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventBus, type PlayerstackContext } from "@playerstack/core";
import { emailGatePlugin } from "./index";
vi.mock("altcha-lib", () => ({
  solveChallenge: () => ({ promise: Promise.resolve({ number: 7 }) }),
}));
const consent = { text: "I want product updates", version: "2026-10" };
const endpoint = {
  webhookUrl: "https://api.example/leads",
  challengeUrl: "https://api.example/challenge",
};
const challenge = {
  nonce: "nonce",
  altcha: { algorithm: "SHA-256", challenge: "c", salt: "s", signature: "signature" },
};
function setup(options: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const mediaPlayer = Object.assign(document.createElement("video"), {
    play: vi.fn(),
    pause: vi.fn(),
  });
  container.append(mediaPlayer);
  return {
    container,
    mediaPlayer,
    events: createEventBus(),
    config: { src: "movie.mp4", emailGate: { enabled: true, remember: false, ...options } },
  } as unknown as PlayerstackContext;
}
const checkbox = (ctx: PlayerstackContext) =>
  ctx.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
function send(ctx: PlayerstackContext) {
  ctx.container.querySelector<HTMLInputElement>('input[type="email"]')!.value =
    "viewer@example.com";
  ctx.container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("marketing consent", () => {
  it("renders literal optional wording and a clickable label with a separate safe link", async () => {
    const ctx = setup({
      marketingConsent: {
        ...consent,
        text: "<b>Updates</b>",
        href: "/privacy",
        linkText: "Privacy",
      },
    });
    await emailGatePlugin.init(ctx);
    const input = checkbox(ctx);
    expect(input).not.toBeNull();
    expect(input.checked).toBe(false);
    expect(input.required).toBe(false);
    const label = input.closest("label")!;
    expect(label.textContent).toBe("<b>Updates</b>");
    expect(label.querySelector("b")).toBeNull();
    label.click();
    expect(input.checked).toBe(true);
    const link = ctx.container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/privacy");
    expect(link.rel).toBe("noopener noreferrer");
    expect(label.contains(link)).toBe(false);
    emailGatePlugin.destroy?.(ctx);
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "http://["])(
    "omits an invalid consent link (%s)",
    async (href) => {
      const ctx = setup({ marketingConsent: { ...consent, href, linkText: "Policy" } });
      await emailGatePlugin.init(ctx);
      expect(checkbox(ctx)).not.toBeNull();
      expect(ctx.container.querySelector("a")).toBeNull();
      emailGatePlugin.destroy?.(ctx);
    },
  );
  for (const format of ["open", "object", "base64"])
    for (const checked of [undefined, false, true]) {
      it(`sends only the selected consent fields (${format}, ${checked})`, async () => {
        const fetcher = vi
          .fn()
          .mockResolvedValueOnce(Response.json(challenge))
          .mockResolvedValueOnce(new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetcher);
        const ctx = setup({
          ...(format === "open" ? {} : { ...endpoint, altchaFormat: format }),
          ...(checked === undefined ? {} : { marketingConsent: consent }),
        });
        const submitted = vi.fn();
        ctx.events.on("email-gate:submit", submitted);
        await emailGatePlugin.init(ctx);
        if (checked !== undefined) {
          expect(checkbox(ctx)).not.toBeNull();
          checkbox(ctx).checked = checked;
        }
        send(ctx);
        await vi.waitFor(() => expect(submitted).toHaveBeenCalledOnce());
        const expected =
          checked === undefined
            ? {}
            : checked
              ? {
                  marketingConsent: true,
                  consentVersion: consent.version,
                  consentText: consent.text,
                }
              : { marketingConsent: false };
        const event = submitted.mock.calls[0]![0] as Record<string, unknown>;
        expect(event).toEqual({ email: "viewer@example.com", ...expected });
        if (format === "open") expect(fetcher).not.toHaveBeenCalled();
        else {
          const body = JSON.parse(fetcher.mock.calls[1]![1].body);
          for (const key of ["marketingConsent", "consentVersion", "consentText"]) {
            if (key in expected) expect(body[key]).toBe(expected[key as keyof typeof expected]);
            else expect(body).not.toHaveProperty(key);
          }
          expect(body.nonce).toBe("nonce");
          if (format === "base64") expect(typeof body.altcha).toBe("string");
        }
        emailGatePlugin.destroy?.(ctx);
      });
    }
  it.each([
    { text: "", version: "v" },
    { text: " ", version: "v" },
    { text: "x".repeat(501), version: "v" },
    { text: 1, version: "v" },
    { text: "text", version: "" },
    { text: "text", version: " " },
    { text: "text", version: "x".repeat(65) },
    { text: "text", version: 1 },
    null,
  ])("disables invalid consent configuration (%j)", async (marketingConsent) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = setup({ marketingConsent });
    await emailGatePlugin.init(ctx);
    expect(ctx.container.querySelector("form")).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
  it.each([
    [1, 1],
    [500, 64],
  ])("accepts consent length boundaries (%s, %s)", async (text, version) => {
    const ctx = setup({
      marketingConsent: { text: "x".repeat(text), version: "v".repeat(version) },
    });
    await emailGatePlugin.init(ctx);
    expect(checkbox(ctx)).not.toBeNull();
    emailGatePlugin.destroy?.(ctx);
  });
  it("keeps checkbox state on retry and uses a fresh challenge without consent query fields", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(challenge))
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(Response.json({ ...challenge, nonce: "second" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    const ctx = setup({ ...endpoint, marketingConsent: consent });
    await emailGatePlugin.init(ctx);
    expect(checkbox(ctx)).not.toBeNull();
    checkbox(ctx).checked = true;
    send(ctx);
    await vi.waitFor(() =>
      expect(
        ctx.container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled,
      ).toBe(false),
    );
    expect(checkbox(ctx).checked).toBe(true);
    send(ctx);
    await vi.waitFor(() => expect(ctx.container.querySelector("form")).toBeNull());
    expect(fetcher.mock.calls[0]![0]).toBe(endpoint.challengeUrl);
    expect(JSON.parse(fetcher.mock.calls[3]![1].body)).toMatchObject({
      nonce: "second",
      marketingConsent: true,
      consentText: consent.text,
    });
    emailGatePlugin.destroy?.(ctx);
  });
  it("blocks required consent before GET, focuses it, and clears aria-invalid after selection", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(challenge))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    const ctx = setup({
      ...endpoint,
      marketingConsent: { ...consent, required: true },
      messages: { consentRequired: "Wybierz zgodę" },
    });
    await emailGatePlugin.init(ctx);
    expect(checkbox(ctx)).not.toBeNull();
    expect(checkbox(ctx).required).toBe(true);
    send(ctx);
    expect(fetcher).not.toHaveBeenCalled();
    expect(ctx.container.querySelector('[role="status"]')!.textContent).toBe("Wybierz zgodę");
    expect(checkbox(ctx).getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(checkbox(ctx));
    checkbox(ctx).click();
    expect(checkbox(ctx).hasAttribute("aria-invalid")).toBe(false);
    send(ctx);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toMatchObject({
      marketingConsent: true,
      consentVersion: consent.version,
      consentText: consent.text,
    });
    emailGatePlugin.destroy?.(ctx);
  });
  it.each([false, true])(
    "stores only the existing timestamp memo regardless of selection (%s)",
    async (selected) => {
      const storage = { getItem: vi.fn(), setItem: vi.fn() };
      vi.stubGlobal("localStorage", storage);
      const ctx = setup({ remember: true, marketingConsent: consent });
      await emailGatePlugin.init(ctx);
      checkbox(ctx).checked = selected;
      send(ctx);
      await vi.waitFor(() => expect(storage.setItem).toHaveBeenCalledOnce());
      expect(storage.setItem.mock.calls[0]![0]).toBe("playerstack:email-gate:movie.mp4");
      expect(new Date(storage.setItem.mock.calls[0]![1]).toISOString()).toBe(
        storage.setItem.mock.calls[0]![1],
      );
      emailGatePlugin.destroy?.(ctx);
    },
  );
  it("does not write consent or emit completion after destruction during a pending request", async () => {
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    const ctx = setup({ ...endpoint, remember: true, marketingConsent: consent });
    const event = vi.fn();
    ctx.events.on("email-gate:submit", event);
    await emailGatePlugin.init(ctx);
    expect(checkbox(ctx)).not.toBeNull();
    checkbox(ctx).checked = true;
    send(ctx);
    emailGatePlugin.destroy?.(ctx);
    resolve(Response.json(challenge));
    await Promise.resolve();
    await Promise.resolve();
    expect(event).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(ctx.container.querySelector("form")).toBeNull();
  });
});
describe("configured backend success", () => {
  it.each([
    Response.json({ status: "check_email" }),
    new Response(null, { status: 204 }),
    new Response("accepted", { status: 202 }),
  ])("uses the configured message and memo for every 2xx body (%j)", async (response) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(challenge))
      .mockResolvedValueOnce(response);
    vi.stubGlobal("fetch", fetcher);
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    const ctx = setup({ ...endpoint, remember: true, messages: { success: "Sprawdź pocztę" } });
    await emailGatePlugin.init(ctx);
    send(ctx);
    await vi.waitFor(() => expect(ctx.container.querySelector("form")).toBeNull());
    expect(ctx.container.querySelector('[role="status"]')!.textContent).toBe("Sprawdź pocztę");
    expect(storage.setItem).toHaveBeenCalledOnce();
    emailGatePlugin.destroy?.(ctx);
  });
});
