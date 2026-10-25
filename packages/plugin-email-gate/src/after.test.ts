import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEventBus, type PlayerstackContext } from "@playerstack/core";
import { emailGatePlugin } from "./index";

vi.mock("altcha-lib", () => ({
  solveChallenge: () => ({ promise: Promise.resolve({ number: 7 }) }),
}));
function context(config: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const mediaPlayer = Object.assign(document.createElement("fake-media"), {
    play: vi.fn(),
    pause: vi.fn(),
    currentTime: 0,
    duration: 200,
  });
  container.append(mediaPlayer);
  return {
    container,
    mediaPlayer,
    events: createEventBus(),
    config: {
      src: "movie.mp4",
      emailGate: { enabled: true, ...config },
    },
  } as unknown as PlayerstackContext;
}
const gate = (ctx: PlayerstackContext) => ctx.container.querySelector(".playerstack-email-gate");
function submit(ctx: PlayerstackContext, email = "viewer@example.com") {
  ctx.container.querySelector<HTMLInputElement>("input[type=email]")!.value = email;
  ctx.container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
}
const challenge = (nonce = "n1") => ({
  altcha: { algorithm: "SHA-256", challenge: "c", salt: "s", signature: "sig" },
  nonce,
});
const hardened = {
  webhookUrl: "https://api.example/lead",
  challengeUrl: "https://api.example/challenge?brand=test",
};
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    get length() {
      return store.size;
    },
  });
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("email gate extensions", () => {
  it("after waits for ended, ignores percent, and does not restart completed playback", async () => {
    const ctx = context({ at: "after", atPercent: 10 });
    await emailGatePlugin.init(ctx);
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    expect(gate(ctx)).toBeNull();
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    expect(gate(ctx)).not.toBeNull();
    submit(ctx);
    await vi.waitFor(() => expect(gate(ctx)).toBeNull());
    expect((ctx.mediaPlayer as unknown as { play: unknown }).play).not.toHaveBeenCalled();
  });
  it("percent alone waits for its threshold", async () => {
    const ctx = context({ atPercent: 50 });
    await emailGatePlugin.init(ctx);
    expect(gate(ctx)).toBeNull();
    Object.assign(ctx.mediaPlayer, { currentTime: 100 });
    ctx.mediaPlayer.dispatchEvent(new Event("timeupdate"));
    expect(gate(ctx)).not.toBeNull();
  });
  it("destroy removes the ended listener", async () => {
    const ctx = context({ at: "after" });
    await emailGatePlugin.init(ctx);
    emailGatePlugin.destroy?.(ctx);
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    expect(gate(ctx)).toBeNull();
  });
  it("privacy is described text with a safe relative link", async () => {
    const ctx = context({
      privacy: { text: "<b>Administrator</b>", linkText: "Polityka", href: "/privacy/" },
    });
    await emailGatePlugin.init(ctx);
    const input = ctx.container.querySelector("input[type=email]")!;
    const description = document.getElementById(input.getAttribute("aria-describedby")!);
    expect(description?.textContent).toBe("<b>Administrator</b> Polityka");
    expect(description?.querySelector("b")).toBeNull();
    expect(description?.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer");
  });
  it.each(["javascript:alert(1)", "data:text/html,hi"])(
    "omits unsupported privacy link %s",
    async (href) => {
      const ctx = context({ privacy: { text: "Privacy", linkText: "Read", href } });
      await emailGatePlugin.init(ctx);
      expect(ctx.container.querySelector("a")).toBeNull();
      expect(ctx.container.textContent).toContain("Privacy");
    },
  );
  it.each(["", " ", "x".repeat(101)])("disables invalid product %s", async (product) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = context({ product });
    await emailGatePlugin.init(ctx);
    expect(gate(ctx)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
  it("emits product separately from email", async () => {
    const ctx = context({ product: "Selfware" });
    const handler = vi.fn();
    ctx.events.on("email-gate:submit", handler);
    await emailGatePlugin.init(ctx);
    submit(ctx);
    await vi.waitFor(() =>
      expect(handler).toHaveBeenCalledWith({ email: "viewer@example.com", product: "Selfware" }),
    );
  });
  it("after dismisses with Escape, emits dismiss and never stores memo", async () => {
    const ctx = context({ at: "after" });
    const handler = vi.fn();
    ctx.events.on("email-gate:dismiss", handler);
    await emailGatePlugin.init(ctx);
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    gate(ctx)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(gate(ctx)).toBeNull();
    expect(handler).toHaveBeenCalledOnce();
    expect(localStorage.length).toBe(0);
  });
  it("before is not dismissible by default; opt-in button resumes", async () => {
    const before = context();
    await emailGatePlugin.init(before);
    expect(before.container.querySelector("button[type=button]")).toBeNull();
    const ctx = context({ dismissible: true });
    await emailGatePlugin.init(ctx);
    ctx.container.querySelector<HTMLButtonElement>("button[type=button]")!.click();
    expect(gate(ctx)).toBeNull();
    expect((ctx.mediaPlayer as unknown as { play: unknown }).play).toHaveBeenCalledOnce();
  });
  it("translates heading, label, placeholder, submit, invalid email, dismiss and live status", async () => {
    const ctx = context({
      dismissible: true,
      messages: {
        title: "Kontakt",
        emailLabel: "Adres email",
        placeholder: "Ty@example.pl",
        submit: "Wyślij",
        invalidEmail: "Popraw adres",
        dismiss: "Pomiń",
      },
    });
    await emailGatePlugin.init(ctx);
    submit(ctx, "bad");
    expect(ctx.container.querySelector("h3")?.textContent).toBe("Kontakt");
    expect(ctx.container.querySelector("input[type=email]")?.getAttribute("aria-label")).toBe(
      "Adres email",
    );
    expect(ctx.container.querySelector("input[type=email]")?.getAttribute("placeholder")).toBe(
      "Ty@example.pl",
    );
    expect(ctx.container.querySelector("button[type=submit]")?.textContent).toBe("Wyślij");
    expect(ctx.container.querySelector("button[type=button]")?.textContent).toBe("Pomiń");
    expect(ctx.container.querySelector('[role="status"]')?.textContent).toBe("Popraw adres");
  });
  it("expires old memo and deletes it", async () => {
    const key = "playerstack:email-gate:movie.mp4";
    localStorage.setItem(key, new Date(Date.now() - 2 * 86400000).toISOString());
    const ctx = context({ rememberDays: 1 });
    await emailGatePlugin.init(ctx);
    expect(gate(ctx)).not.toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });
  it("remember false never reads or writes storage", async () => {
    const get = vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw Error("storage");
    });
    const set = vi.spyOn(localStorage, "setItem");
    const ctx = context({ remember: false });
    await emailGatePlugin.init(ctx);
    submit(ctx);
    await vi.waitFor(() => expect(gate(ctx)).toBeNull());
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
  it("storage exceptions do not prevent display or successful playback", async () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw Error("storage");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw Error("storage");
    });
    const ctx = context();
    await emailGatePlugin.init(ctx);
    submit(ctx);
    await vi.waitFor(() => expect(gate(ctx)).toBeNull());
    expect((ctx.mediaPlayer as unknown as { play: unknown }).play).toHaveBeenCalledOnce();
  });
  it.each(["object", "base64"])(
    "sends %s payload, product query and fresh nonce on retry",
    async (altchaFormat) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(Response.json(challenge("first")))
        .mockResolvedValueOnce(new Response(null, { status: 400 }))
        .mockResolvedValueOnce(Response.json(challenge("second")))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      vi.stubGlobal("fetch", fetcher);
      const ctx = context({ ...hardened, product: "Selfware / demo", altchaFormat });
      await emailGatePlugin.init(ctx);
      submit(ctx);
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      await vi.waitFor(() =>
        expect(
          ctx.container.querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
        ).toBe(false),
      );
      submit(ctx);
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
      const url = new URL(fetcher.mock.calls[0]![0]);
      expect(url.searchParams.get("brand")).toBe("test");
      expect(url.searchParams.get("product")).toBe("Selfware / demo");
      const payload = JSON.parse(fetcher.mock.calls[3]![1].body);
      expect(payload).toMatchObject({
        product: "Selfware / demo",
        src: "movie.mp4",
        nonce: "second",
      });
      const altcha = altchaFormat === "base64" ? JSON.parse(atob(payload.altcha)) : payload.altcha;
      expect(altcha).toEqual({ ...challenge().altcha, number: 7 });
    },
  );
  it.each([
    [429, "Limit"],
    [403, "Odrzucono"],
    [500, "Sieć"],
  ])("maps HTTP %s to configured message", async (code, message) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(challenge()))
        .mockResolvedValueOnce(new Response(null, { status: code as number })),
    );
    const ctx = context({
      ...hardened,
      messages: { rateLimit: "Limit", rejected: "Odrzucono", networkError: "Sieć" },
    });
    await emailGatePlugin.init(ctx);
    submit(ctx);
    await vi.waitFor(() =>
      expect(ctx.container.querySelector('[role="status"]')?.textContent).toBe(message),
    );
  });
  it("refuses flat challenge and displays network message without posting", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(challenge().altcha));
    vi.stubGlobal("fetch", fetcher);
    const ctx = context({ ...hardened, messages: { networkError: "Błąd sieci" } });
    await emailGatePlugin.init(ctx);
    submit(ctx);
    await vi.waitFor(() =>
      expect(ctx.container.querySelector('[role="status"]')?.textContent).toBe("Błąd sieci"),
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe("email gate lifecycle and translated results", () => {
  it("shows the full Polish submission lifecycle and a persistent success status", async () => {
    let resolveChallenge!: (response: Response) => void;
    let resolvePost!: (response: Response) => void;
    const first = new Promise<Response>((resolve) => {
      resolveChallenge = resolve;
    });
    const second = new Promise<Response>((resolve) => {
      resolvePost = resolve;
    });
    const fetcher = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    vi.stubGlobal("fetch", fetcher);
    const ctx = context({
      ...hardened,
      messages: {
        title: "Kontakt",
        emailLabel: "Adres email",
        placeholder: "Ty@example.pl",
        submit: "Wyślij",
        verifying: "Weryfikuję",
        solving: "Rozwiązuję",
        submitting: "Wysyłam",
        success: "Dziękuję",
        invalidEmail: "Popraw adres",
        rejected: "Odrzucono",
        rateLimit: "Limit",
        networkError: "Sieć",
        dismiss: "Pomiń",
      },
    });
    await emailGatePlugin.init(ctx);
    submit(ctx);
    const status = ctx.container.querySelector('[role="status"]')!;
    expect(status.textContent).toBe("Weryfikuję");
    const seen: string[] = [];
    const observer = new MutationObserver(() => {
      seen.push(status.textContent ?? "");
    });
    observer.observe(status, { childList: true });
    resolveChallenge(Response.json(challenge()));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(seen).toContain("Rozwiązuję");
    expect(status.textContent).toBe("Wysyłam");
    resolvePost(new Response(null, { status: 204 }));
    await vi.waitFor(() => expect(gate(ctx)).toBeNull());
    expect(status.isConnected).toBe(true);
    expect(status.textContent).toBe("Dziękuję");
    observer.disconnect();
    emailGatePlugin.destroy?.(ctx);
    expect(status.isConnected).toBe(false);
  });
  it.each([false, true])(
    "does not finish a pending request after dismissal or destroy (%s)",
    async (destroy) => {
      let resolve!: (response: Response) => void;
      const fetcher = vi.fn().mockReturnValue(
        new Promise<Response>((r) => {
          resolve = r;
        }),
      );
      vi.stubGlobal("fetch", fetcher);
      const ctx = context({ ...hardened, dismissible: true });
      const handler = vi.fn();
      ctx.events.on("email-gate:submit", handler);
      await emailGatePlugin.init(ctx);
      submit(ctx);
      submit(ctx);
      expect(fetcher).toHaveBeenCalledOnce();
      if (destroy) emailGatePlugin.destroy?.(ctx);
      else ctx.container.querySelector<HTMLButtonElement>("button[type=button]")!.click();
      resolve(Response.json(challenge()));
      await new Promise((r) => setTimeout(r, 0));
      expect(fetcher).toHaveBeenCalledOnce();
      expect(handler).not.toHaveBeenCalled();
      expect(localStorage.length).toBe(0);
    },
  );
  it("shows network failure and allows a new challenge after fetch rejection", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(Error("internal detail"))
      .mockResolvedValueOnce(Response.json(challenge()))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const ctx = context({ ...hardened, messages: { networkError: "Sieć" } });
    await emailGatePlugin.init(ctx);
    submit(ctx);
    await vi.waitFor(() =>
      expect(ctx.container.querySelector('[role="status"]')?.textContent).toBe("Sieć"),
    );
    expect(ctx.container.textContent).not.toContain("internal detail");
    submit(ctx);
    await vi.waitFor(() => expect(gate(ctx)).toBeNull());
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it.each([{}, { nonce: 4, altcha: challenge().altcha }, { nonce: "n", altcha: {} }, null])(
    "rejects malformed challenge %#",
    async (body) => {
      const fetcher = vi.fn().mockResolvedValue(Response.json(body));
      vi.stubGlobal("fetch", fetcher);
      const ctx = context({ ...hardened });
      await emailGatePlugin.init(ctx);
      submit(ctx);
      await vi.waitFor(() =>
        expect(
          ctx.container.querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
        ).toBe(false),
      );
      expect(fetcher).toHaveBeenCalledOnce();
      expect(localStorage.length).toBe(0);
    },
  );
  it("preserves non-expiring legacy memo and accepts a fresh TTL memo", async () => {
    const key = "playerstack:email-gate:movie.mp4";
    localStorage.setItem(key, "legacy-value");
    const legacy = context();
    await emailGatePlugin.init(legacy);
    expect(gate(legacy)).toBeNull();
    localStorage.setItem(key, new Date().toISOString());
    const fresh = context({ rememberDays: 1 });
    await emailGatePlugin.init(fresh);
    expect(gate(fresh)).toBeNull();
  });
  it.each(["x", "x".repeat(100)])("accepts product boundary of %s", async (product) => {
    const ctx = context({ product });
    await emailGatePlugin.init(ctx);
    expect(gate(ctx)).not.toBeNull();
  });
  it("after dismissible false ignores Escape and renders no dismissal button", async () => {
    const ctx = context({ at: "after", dismissible: false });
    await emailGatePlugin.init(ctx);
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    gate(ctx)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(gate(ctx)).not.toBeNull();
    expect(ctx.container.querySelector("button[type=button]")).toBeNull();
  });
});

it("renders independent privacy descriptions when randomUUID is unavailable", async () => {
  vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
  const a = context({ privacy: { text: "First" } });
  const b = context({ privacy: { text: "Second" } });
  await emailGatePlugin.init(a);
  await emailGatePlugin.init(b);
  const first = a.container.querySelector("input[type=email]")!.getAttribute("aria-describedby");
  const second = b.container.querySelector("input[type=email]")!.getAttribute("aria-describedby");
  expect(first).not.toBe(second);
  expect(document.getElementById(first!)?.textContent).toBe("First");
  expect(document.getElementById(second!)?.textContent).toBe("Second");
});
