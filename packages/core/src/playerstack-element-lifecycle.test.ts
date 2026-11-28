import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("media-chrome/dist/media-controller.js", () => ({}));
vi.mock("media-chrome/dist/media-keyboard-shortcuts-dialog.js", () => ({}));
vi.mock("media-chrome/dist/media-control-bar.js", () => ({}));
vi.mock("media-chrome/dist/media-play-button.js", () => ({}));
vi.mock("media-chrome/dist/media-mute-button.js", () => ({}));
vi.mock("media-chrome/dist/media-time-display.js", () => ({}));
vi.mock("media-chrome/dist/media-time-range.js", () => ({}));
vi.mock("media-chrome/dist/media-fullscreen-button.js", () => ({}));
import {
  definePlayerstackElement,
  setConfigProviderForElement,
  setPluginsForElement,
} from "./playerstack-element";
import { createInlineConfigProvider, type PlayerstackConfig } from "./config";
import {
  setProviderImporter,
  _resetProvidersForTesting,
  type LazyMediaElementTag,
} from "./providers";
import type { PlayerstackPlugin } from "./plugins";

definePlayerstackElement();

afterEach(() => {
  document.body.replaceChildren();
  setPluginsForElement([]);
  setConfigProviderForElement(createInlineConfigProvider());
  _resetProvidersForTesting();
});

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Provider importer whose load the test finishes by hand. */
function manualImporter() {
  const loads = new Map<LazyMediaElementTag, ReturnType<typeof deferred<void>>>();
  const importer = vi.fn((tag: LazyMediaElementTag) => {
    const d = deferred();
    loads.set(tag, d);
    return d.promise.then(() => {
      if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {});
    });
  });
  setProviderImporter(importer);
  return { importer, loads };
}

function recordingPlugin(): PlayerstackPlugin & {
  inits: Element[];
  destroys: number;
  connectedAtInit: boolean[];
} {
  const plugin = {
    name: "record",
    inits: [] as Element[],
    destroys: 0,
    connectedAtInit: [] as boolean[],
    init(ctx: { container: HTMLElement }) {
      plugin.inits.push(ctx.container);
      plugin.connectedAtInit.push(ctx.container.isConnected);
    },
    destroy() {
      plugin.destroys++;
    },
  };
  return plugin;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

/**
 * happy-dom keeps one CustomElementRegistry per file and a resolved load
 * defines the tag, so each test below uses its own provider and passes in any order.
 */
function mount(src: string): HTMLElement {
  document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
  const el = document.createElement("player-stack");
  el.setAttribute("src", src);
  document.getElementById("a")!.appendChild(el);
  return el;
}

describe("lifecycle while the provider downloads", () => {
  it("does not initialize plugins on an element removed before the provider loaded", async () => {
    const { loads } = manualImporter();
    const plugin = recordingPlugin();
    setPluginsForElement([plugin]);
    const el = mount("https://example.com/live.m3u8");
    await vi.waitFor(() => expect(loads.has("hls-video")).toBe(true));
    el.remove();
    loads.get("hls-video")!.resolve();
    await flush();
    await flush();
    expect(plugin.inits).toHaveLength(0);
    expect(el.querySelector("media-controller")).toBeNull();
  });

  it("builds exactly one controller after a move during the provider download", async () => {
    const { importer, loads } = manualImporter();
    const plugin = recordingPlugin();
    setPluginsForElement([plugin]);
    const el = mount("https://vimeo.com/76979871");
    await vi.waitFor(() => expect(loads.has("vimeo-video")).toBe(true));
    document.getElementById("b")!.appendChild(el);
    loads.get("vimeo-video")!.resolve();
    await vi.waitFor(() => expect(el.querySelector("vimeo-video")).not.toBeNull());
    await flush();
    expect(importer).toHaveBeenCalledTimes(1);
    expect(el.querySelectorAll("media-controller")).toHaveLength(1);
    expect(plugin.inits).toHaveLength(1);
    expect(plugin.connectedAtInit).toEqual([true]);
  });

  it("dispatches playerstack:error and builds no player when the provider fails", async () => {
    const { loads } = manualImporter();
    const plugin = recordingPlugin();
    setPluginsForElement([plugin]);
    const errors: CustomEvent[] = [];
    document.addEventListener("playerstack:error", (e) => errors.push(e as CustomEvent), {
      once: true,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const el = mount("https://fast.wistia.com/embed/medias/abc123");
    await vi.waitFor(() => expect(loads.has("wistia-video")).toBe(true));
    loads.get("wistia-video")!.reject(new Error("offline"));
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(errors[0]!.detail).toMatchObject({ reason: "provider-load", tag: "wistia-video" });
    expect(el.querySelector("media-controller")).toBeNull();
    expect(plugin.inits).toHaveLength(0);
    vi.mocked(console.error).mockRestore();
  });

  it("waits for the provider before creating the media element", async () => {
    const { loads } = manualImporter();
    const el = mount("https://youtu.be/_cMxraX_5RE");
    await vi.waitFor(() => expect(loads.has("youtube-video")).toBe(true));
    await flush();
    expect(el.querySelector("youtube-video")).toBeNull();
    loads.get("youtube-video")!.resolve();
    await vi.waitFor(() => expect(el.querySelector("youtube-video")).not.toBeNull());
  });

  it("switches provider when src changes to another type during the download", async () => {
    const { loads } = manualImporter();
    const el = mount("https://www.twitch.tv/somechannel");
    await vi.waitFor(() => expect(loads.has("twitch-video")).toBe(true));
    el.setAttribute("src", "https://example.com/v.mp4");
    el.setAttribute("title", "Changed");
    loads.get("twitch-video")!.resolve();
    await vi.waitFor(() =>
      expect(el.querySelector("video")?.getAttribute("src")).toBe("https://example.com/v.mp4"),
    );
    expect(el.querySelector("twitch-video")).toBeNull();
    expect(el.querySelector("video")!.getAttribute("title")).toBe("Changed");
  });
});

describe("lifecycle while the config loads", () => {
  it("builds one controller after a move during an asynchronous config load", async () => {
    const loads: ReturnType<typeof deferred<PlayerstackConfig>>[] = [];
    setConfigProviderForElement({
      name: "slow",
      load() {
        const d = deferred<PlayerstackConfig>();
        loads.push(d);
        return d.promise;
      },
    });
    const plugin = recordingPlugin();
    setPluginsForElement([plugin]);
    document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
    const el = document.createElement("player-stack");
    document.getElementById("a")!.appendChild(el);
    document.getElementById("b")!.appendChild(el);
    for (const d of loads) d.resolve({ src: "https://example.com/v.mp4" });
    await vi.waitFor(() => expect(el.querySelector("video")).not.toBeNull());
    await flush();
    expect(el.querySelectorAll("media-controller")).toHaveLength(1);
    expect(plugin.inits).toHaveLength(1);
  });
});

describe("lifecycle while plugins initialize", () => {
  it("destroys the started registry and does not resume it on a detached element", async () => {
    const gate = deferred();
    const calls: string[] = [];
    setPluginsForElement([
      {
        name: "slow",
        async init() {
          calls.push("slow:init");
          await gate.promise;
        },
        destroy() {
          calls.push("slow:destroy");
        },
      },
      {
        name: "after",
        init() {
          calls.push("after:init");
        },
      },
    ]);
    document.body.innerHTML = `<player-stack src="https://example.com/v.mp4"></player-stack>`;
    const el = document.querySelector("player-stack")!;
    await vi.waitFor(() => expect(calls).toContain("slow:init"));
    el.remove();
    gate.resolve();
    await flush();
    await flush();
    expect(calls).toEqual(["slow:init", "slow:destroy"]);
    expect(el.querySelector("media-controller")).toBeNull();
  });

  it("ends with one controller after a move during plugin init", async () => {
    const gate = deferred();
    let inits = 0;
    setPluginsForElement([
      {
        name: "slow",
        async init() {
          inits++;
          if (inits === 1) await gate.promise;
        },
      },
    ]);
    document.body.innerHTML = `<div id="a"><player-stack src="https://example.com/v.mp4"></player-stack></div><div id="b"></div>`;
    const el = document.querySelector("player-stack")!;
    await vi.waitFor(() => expect(inits).toBe(1));
    document.getElementById("b")!.appendChild(el);
    await vi.waitFor(() => expect(inits).toBe(2));
    gate.resolve();
    await vi.waitFor(() => expect(el.querySelector("video")?.hasAttribute("src")).toBe(true));
    await flush();
    expect(el.querySelectorAll("media-controller")).toHaveLength(1);
    expect((el.querySelector("media-controller") as HTMLElement).style.visibility).toBe("");
  });
});
