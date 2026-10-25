import { afterEach, expect, it, vi } from "vitest";
import { createEventBus, type PlayerstackContext } from "@playerstack/core";
import { emailGatePlugin } from "./index";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./load-hardened", () => ({ loadHardened: load }));
const contexts: PlayerstackContext[] = [];
afterEach(() => {
  contexts.forEach((ctx) => emailGatePlugin.destroy?.(ctx));
  contexts.length = 0;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  load.mockReset();
});
async function setup(hardened = true, extra: Record<string, unknown> = {}) {
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
        messages: { networkError: "Retry network" },
        ...extra,
        ...(hardened
          ? {
              webhookUrl: "https://api.example/lead",
              challengeUrl: "https://api.example/challenge",
            }
          : {}),
      },
    },
  } as unknown as PlayerstackContext;
  contexts.push(ctx);
  await emailGatePlugin.init(ctx);
  const input = container.querySelector<HTMLInputElement>('input[type="email"]')!;
  input.value = "viewer@example.com";
  const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const send = () =>
    container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
  const emitted = vi.fn();
  ctx.events.on("email-gate:submit", emitted);
  return { ctx, input, submit, send, emitted };
}
it.each([
  {},
  { privacy: { text: "Privacy" } },
  { marketingConsent: { text: "News", version: "1" } },
])("never loads hardened code for an open form with %j", async (extra) => {
  const f = await setup(false, extra);
  f.send();
  await Promise.resolve();
  expect(f.emitted).toHaveBeenCalledOnce();
  expect(load).not.toHaveBeenCalled();
});
it("reports chunk failure and permits a fresh attempt without releasing the overlay", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => Promise.resolve(Response.json({}))),
  );
  load.mockRejectedValueOnce(new Error("404")).mockResolvedValueOnce({
    submitChallenge: ({ success }: { success: () => void }) => success(),
  });
  const f = await setup();
  expect(load).not.toHaveBeenCalled();
  f.submit.focus();
  f.send();
  await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(f.submit.disabled).toBe(false));
  expect(f.ctx.container.textContent).toContain("Retry network");
  expect(document.activeElement).toBe(f.input);
  expect(f.ctx.container.querySelector("form")).not.toBeNull();
  f.send();
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(f.emitted).toHaveBeenCalledOnce());
  expect(f.ctx.container.querySelector("form")).toBeNull();
});
it.each([false, true])("ignores chunk completion after destroy (reject=%s)", async (reject) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => Promise.resolve(Response.json({}))),
  );
  let resolve!: (value: unknown) => void;
  let fail!: (reason: Error) => void;
  load.mockReturnValue(
    new Promise((r, j) => {
      resolve = r;
      fail = j;
    }),
  );
  const f = await setup();
  f.send();
  await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
  emailGatePlugin.destroy?.(f.ctx);
  const validate = vi.fn();
  if (reject) fail(new Error("404"));
  else resolve({ submitChallenge: validate });
  await new Promise((r) => setTimeout(r, 0));
  expect(validate).not.toHaveBeenCalled();
  expect(f.emitted).not.toHaveBeenCalled();
  expect(f.ctx.container.querySelector("form")).toBeNull();
  expect(f.ctx.container.querySelector(".playerstack-email-gate-status")).toBeNull();
});

it.each([false, true])("ignores chunk completion after dismissal (reject=%s)", async (reject) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
  let finish!: (value: unknown) => void;
  let fail!: (error: Error) => void;
  load.mockReturnValue(
    new Promise((resolve, reject) => {
      finish = resolve;
      fail = reject;
    }),
  );
  const f = await setup(true, { dismissible: true });
  f.send();
  expect(load).toHaveBeenCalledOnce();
  f.ctx.container.querySelector<HTMLButtonElement>("button[type=button]")!.click();
  const validate = vi.fn();
  if (reject) fail(new Error("offline"));
  else finish({ submitChallenge: validate });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(validate).not.toHaveBeenCalled();
  expect(f.emitted).not.toHaveBeenCalled();
  expect(f.ctx.container.querySelector("form")).toBeNull();
  expect(f.ctx.container.querySelector(".playerstack-email-gate-status")).toBeNull();
});
