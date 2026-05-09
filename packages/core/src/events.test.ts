import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "./events";

describe("createEventBus", () => {
  it("returns an object with on, off, emit functions", () => {
    const bus = createEventBus();
    expect(typeof bus.on).toBe("function");
    expect(typeof bus.off).toBe("function");
    expect(typeof bus.emit).toBe("function");
  });

  it("invokes a registered handler with the payload when emit is called", () => {
    const bus = createEventBus<{ play: { time: number } }>();
    const handler = vi.fn();

    bus.on("play", handler);
    bus.emit("play", { time: 12.5 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ time: 12.5 });
  });

  it("does not invoke handlers for other event names", () => {
    const bus = createEventBus<{ play: void; pause: void }>();
    const playHandler = vi.fn();
    const pauseHandler = vi.fn();

    bus.on("play", playHandler);
    bus.on("pause", pauseHandler);
    bus.emit("play", undefined);

    expect(playHandler).toHaveBeenCalledTimes(1);
    expect(pauseHandler).not.toHaveBeenCalled();
  });

  it("emit with zero listeners does not throw", () => {
    const bus = createEventBus<{ ended: void }>();
    expect(() => bus.emit("ended", undefined)).not.toThrow();
  });

  it("supports multiple handlers for the same event, called in registration order", () => {
    const bus = createEventBus<{ progress: number }>();
    const calls: Array<["a" | "b", number]> = [];

    bus.on("progress", (v) => calls.push(["a", v]));
    bus.on("progress", (v) => calls.push(["b", v]));
    bus.emit("progress", 42);

    expect(calls).toEqual([
      ["a", 42],
      ["b", 42],
    ]);
  });

  it("off removes a specific handler and leaves others intact", () => {
    const bus = createEventBus<{ seek: number }>();
    const a = vi.fn();
    const b = vi.fn();

    bus.on("seek", a);
    bus.on("seek", b);
    bus.off("seek", a);
    bus.emit("seek", 7);

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(7);
  });

  it("off returns true when the handler was registered, false otherwise", () => {
    const bus = createEventBus<{ play: void }>();
    const handler = vi.fn();

    bus.on("play", handler);
    expect(bus.off("play", handler)).toBe(true);
    expect(bus.off("play", handler)).toBe(false);
  });

  it("on returns an unsubscribe function that removes the handler", () => {
    const bus = createEventBus<{ play: void }>();
    const handler = vi.fn();

    const unsubscribe = bus.on("play", handler);
    unsubscribe();
    bus.emit("play", undefined);

    expect(handler).not.toHaveBeenCalled();
  });

  it("a handler that throws does not prevent later handlers from running", () => {
    const bus = createEventBus<{ ended: void }>();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = vi.fn(() => {
      throw new Error("boom");
    });
    const b = vi.fn();

    bus.on("ended", a);
    bus.on("ended", b);
    bus.emit("ended", undefined);

    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
