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
