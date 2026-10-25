import { afterEach, expect, it, vi } from "vitest";
import { createEventBus, type PlayerstackContext } from "@playerstack/core";
import { emailGatePlugin } from "./index";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./load-optional-fields", () => ({ loadOptionalFields: load }));
afterEach(() => {
  document.body.replaceChildren();
  load.mockReset();
});
it("does not render optional fields when destroyed during their download", async () => {
  let finish!: (value: unknown) => void;
  load.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const container = document.createElement("div");
  document.body.append(container);
  const mediaPlayer = Object.assign(document.createElement("video"), { pause: vi.fn() });
  const ctx = {
    container,
    mediaPlayer,
    events: createEventBus(),
    config: {
      src: "movie.mp4",
      emailGate: { enabled: true, remember: false, privacy: { text: "Privacy" } },
    },
  } as unknown as PlayerstackContext;
  const init = emailGatePlugin.init(ctx);
  expect(load).toHaveBeenCalledOnce();
  emailGatePlugin.destroy?.(ctx);
  const validate = vi.fn();
  finish({ validConfig: validate });
  await init;
  expect(validate).not.toHaveBeenCalled();
  expect(container.querySelector("form")).toBeNull();
  expect(mediaPlayer.pause).not.toHaveBeenCalled();
});

function context(at: "before" | "after" | number, dismissible = false) {
  const container = document.createElement("div");
  document.body.append(container);
  const mediaPlayer = Object.assign(document.createElement("div"), {
    pause: vi.fn(),
    currentTime: 10,
  });
  container.append(mediaPlayer);
  return {
    container,
    mediaPlayer,
    events: createEventBus(),
    config: {
      src: "movie.mp4",
      emailGate: {
        enabled: true,
        remember: false,
        at,
        dismissible,
        privacy: { text: "Privacy" },
        messages: { networkError: "Download failed", submit: "Retry" },
      },
    },
  } as unknown as PlayerstackContext;
}

it.each(["before", "after", 5] as const)("retains %s trigger while fields download", async (at) => {
  let finish!: (value: unknown) => void;
  load.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const ctx = context(at);
  const init = emailGatePlugin.init(ctx);
  ctx.mediaPlayer.dispatchEvent(new Event(at === "after" ? "ended" : "timeupdate"));
  expect(ctx.container.querySelector("form")).toBeNull();
  finish(await import("./optional-fields"));
  await init;
  await vi.waitFor(() => expect(ctx.container.querySelector('input[type="email"]')).not.toBeNull());
  expect(ctx.container.textContent).toContain("Privacy");
  emailGatePlugin.destroy?.(ctx);
});

it.each(["before", "after"] as const)(
  "keeps %s gate available after repeated field download errors",
  async (at) => {
    load.mockRejectedValue(new Error("offline"));
    const ctx = context(at);
    const submitted = vi.fn();
    ctx.events.on("email-gate:submit", submitted);
    const init = emailGatePlugin.init(ctx);
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    await init;
    await vi.waitFor(() => expect(ctx.container.textContent).toContain("Download failed"));
    expect(load).toHaveBeenCalledTimes(2);
    expect(ctx.container.querySelector("input")).toBeNull();
    expect(ctx.container.querySelectorAll("button")).toHaveLength(1);
    ctx.container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(submitted).not.toHaveBeenCalled();
    load.mockResolvedValue(await import("./optional-fields"));
    ctx.container.querySelector("button")!.click();
    await vi.waitFor(() =>
      expect(ctx.container.querySelector('input[type="email"]')).not.toBeNull(),
    );
    expect(ctx.container.textContent).toContain("Privacy");
    emailGatePlugin.destroy?.(ctx);
  },
);

it.each([false, true])(
  "uses overlay focus and configured dismissal after load failure (%s)",
  async (dismissible) => {
    load.mockRejectedValue(new Error("offline"));
    const ctx = context("after", dismissible);
    const control = document.createElement("button");
    ctx.container.append(control);
    control.focus();
    await emailGatePlugin.init(ctx);
    ctx.mediaPlayer.dispatchEvent(new Event("ended"));
    await vi.waitFor(() => expect(ctx.container.textContent).toContain("Download failed"));
    const overlay = ctx.container.querySelector<HTMLElement>(".playerstack-email-gate")!;
    expect(document.activeElement).toBe(overlay.querySelector("button"));
    expect(control.hasAttribute("inert")).toBe(true);
    expect(overlay.querySelectorAll("button")).toHaveLength(dismissible ? 2 : 1);
    overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(overlay.isConnected).toBe(!dismissible);
    emailGatePlugin.destroy?.(ctx);
    expect(control.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(control);
  },
);

it("ignores a failed field download after destroy", async () => {
  let fail!: (error: Error) => void;
  load.mockReturnValue(
    new Promise((_, reject) => {
      fail = reject;
    }),
  );
  const ctx = context("before");
  const init = emailGatePlugin.init(ctx);
  emailGatePlugin.destroy?.(ctx);
  fail(new Error("offline"));
  await init;
  expect(load).toHaveBeenCalledOnce();
  expect(ctx.container.querySelector("form")).toBeNull();
});

it("keeps the error overlay mounted while retry is pending", async () => {
  load.mockRejectedValue(new Error("offline"));
  const ctx = context("after");
  await emailGatePlugin.init(ctx);
  ctx.mediaPlayer.dispatchEvent(new Event("ended"));
  await vi.waitFor(() => expect(ctx.container.textContent).toContain("Download failed"));
  const overlay = ctx.container.querySelector(".playerstack-email-gate")!;
  let finish!: (value: unknown) => void;
  load.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  overlay.querySelector("button")!.click();
  expect(overlay.isConnected).toBe(true);
  finish(await import("./optional-fields"));
  await vi.waitFor(() => expect(ctx.container.querySelector('input[type="email"]')).not.toBeNull());
  expect(ctx.container.querySelectorAll(".playerstack-email-gate")).toHaveLength(1);
  emailGatePlugin.destroy?.(ctx);
});

it("stops retry completion when restoring focus destroys the gate", async () => {
  load.mockRejectedValue(new Error("offline"));
  const ctx = context("after");
  const control = document.createElement("button");
  ctx.container.append(control);
  control.focus();
  await emailGatePlugin.init(ctx);
  ctx.mediaPlayer.dispatchEvent(new Event("ended"));
  await vi.waitFor(() => expect(ctx.container.textContent).toContain("Download failed"));
  control.addEventListener("focus", () => emailGatePlugin.destroy?.(ctx), { once: true });
  load.mockResolvedValue(await import("./optional-fields"));
  ctx.container.querySelector<HTMLButtonElement>("button[type=submit]")!.click();
  await vi.waitFor(() => expect(ctx.container.querySelector(".playerstack-email-gate")).toBeNull());
});
