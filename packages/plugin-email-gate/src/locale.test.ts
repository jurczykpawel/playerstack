import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventBus, type PlayerstackContext } from "@playerstack/core";
import { emailGatePlugin } from "./index";

vi.mock("altcha-lib", () => ({
  solveChallenge: () => ({ promise: Promise.resolve({ number: 7 }) }),
}));
const altcha = { algorithm: "SHA-256", challenge: "c", salt: "s", signature: "sig" };
const contexts: PlayerstackContext[] = [];
afterEach(() => {
  contexts.forEach((ctx) => emailGatePlugin.destroy?.(ctx));
  contexts.length = 0;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Mode = "open" | "nonce" | "altcha";
async function submit(mode: Mode, extra: Record<string, unknown>) {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(mode === "altcha" ? altcha : { altcha, nonce: "n" }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const container = document.createElement("div");
  const mediaPlayer = Object.assign(document.createElement("video"), {
    pause: vi.fn(),
    play: vi.fn(),
  });
  container.append(mediaPlayer);
  document.body.append(container);
  const ctx = {
    container,
    mediaPlayer,
    events: createEventBus(),
    config: {
      src: "movie.mp4",
      emailGate: {
        enabled: true,
        remember: false,
        ...(mode === "open"
          ? {}
          : {
              webhookUrl: "https://api.example/lead",
              challengeUrl: "https://api.example/challenge",
              challengeMode: mode,
            }),
        ...extra,
      },
    },
  } as unknown as PlayerstackContext;
  contexts.push(ctx);
  const emitted = vi.fn();
  ctx.events.on("email-gate:submit", emitted);
  await emailGatePlugin.init(ctx);
  container.querySelector<HTMLInputElement>('input[type="email"]')!.value = "viewer@example.com";
  container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
  await vi.waitFor(() => expect(emitted).toHaveBeenCalledOnce());
  const body = mode === "open" ? undefined : JSON.parse(fetcher.mock.calls[1]![1].body);
  return { fetcher, event: emitted.mock.calls[0]![0], body };
}

describe("locale", () => {
  it.each(["en", "pl", "en-GB"])("open mode puts %s in the submit event", async (locale) => {
    const { event, fetcher } = await submit("open", { locale });
    expect(event).toEqual({ email: "viewer@example.com", locale });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["nonce", "altcha"] as const)("%s mode posts the locale", async (mode) => {
    const { event, body, fetcher } = await submit(mode, { locale: "en" });
    expect(body.locale).toBe("en");
    expect(event.locale).toBe("en");
    expect(fetcher.mock.calls[0]![0]).toBe("https://api.example/challenge");
  });

  it("travels with product and marketing consent", async () => {
    const { body } = await submit("nonce", {
      locale: "en",
      product: "guide",
      marketingConsent: { text: "News", version: "1" },
    });
    expect(body).toMatchObject({ locale: "en", product: "guide", marketingConsent: false });
  });

  it("is absent when not configured", async () => {
    const { event, body } = await submit("nonce", {});
    expect("locale" in body).toBe(false);
    expect("locale" in event).toBe(false);
  });

  it.each(["", "EN", "eng", "en_US", "en-us", "en-GB-x", " en", "en\n", 5, ["en"], null])(
    "ignores %j with a warning and still submits",
    async (locale) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { event, body } = await submit("nonce", { locale });
      expect("locale" in body).toBe(false);
      expect("locale" in event).toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("locale"));
    },
  );
});
