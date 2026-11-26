import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventBus, type PlayerstackContext } from "@playerstack/core";
import { emailGatePlugin } from "./index";

vi.mock("altcha-lib", () => ({
  solveChallenge: () => ({ promise: Promise.resolve({ number: 7 }) }),
}));
const flat = {
  algorithm: "SHA-256",
  challenge: "c",
  maxnumber: 100000,
  salt: "s",
  signature: "sig",
};
async function run(body: unknown, extra: Record<string, unknown> = {}) {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(body))
    .mockResolvedValueOnce(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const container = document.createElement("div");
  const mediaPlayer = Object.assign(document.createElement("fake-media"), {
    play: vi.fn(),
    pause: vi.fn(),
  });
  container.append(mediaPlayer);
  document.body.append(container);
  const emitted = vi.fn();
  const ctx = {
    container,
    mediaPlayer,
    events: createEventBus(),
    config: {
      src: "movie.mp4",
      emailGate: {
        enabled: true,
        remember: false,
        product: "Demo / film",
        webhookUrl: "https://api.example/lead",
        challengeUrl: "https://api.example/challenge?brand=test",
        ...extra,
      },
    },
  } as unknown as PlayerstackContext;
  ctx.events.on("email-gate:submit", emitted);
  await emailGatePlugin.init(ctx);
  container.querySelector<HTMLInputElement>("input[type=email]")!.value = "viewer@example.com";
  container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
  const submit = container.querySelector<HTMLButtonElement>("button[type=submit]")!;
  await vi.waitFor(() => expect(submit.disabled && submit.isConnected).toBe(false));
  return { fetcher, emitted };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("challengeMode", () => {
  it.each([undefined, "nonce", "ALTCHA", true])(
    "mode %s refuses a flat challenge",
    async (mode) => {
      const { fetcher, emitted } = await run(flat, { challengeMode: mode });
      expect(fetcher).toHaveBeenCalledOnce();
      expect(emitted).not.toHaveBeenCalled();
    },
  );

  it.each(["object", "base64"])("altcha mode submits %s solution without nonce", async (format) => {
    const { fetcher, emitted } = await run(flat, { challengeMode: "altcha", altchaFormat: format });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const url = new URL(fetcher.mock.calls[0]![0]);
    expect(url.searchParams.get("brand")).toBe("test");
    expect(url.searchParams.get("product")).toBe("Demo / film");
    const payload = JSON.parse(fetcher.mock.calls[1]![1].body);
    expect(payload).toMatchObject({
      email: "viewer@example.com",
      src: "movie.mp4",
      product: "Demo / film",
    });
    expect("nonce" in payload).toBe(false);
    const altcha = format === "base64" ? JSON.parse(atob(payload.altcha)) : payload.altcha;
    expect(altcha).toEqual({
      algorithm: "SHA-256",
      challenge: "c",
      salt: "s",
      signature: "sig",
      number: 7,
    });
    expect(emitted).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    {},
    { altcha: flat, nonce: "n" },
    { ...flat, algorithm: "MD5" },
    { ...flat, signature: "" },
    { ...flat, maxnumber: -1 },
  ])("altcha mode rejects malformed challenge %#", async (body) => {
    const { fetcher, emitted } = await run(body, { challengeMode: "altcha" });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(emitted).not.toHaveBeenCalled();
  });
});
