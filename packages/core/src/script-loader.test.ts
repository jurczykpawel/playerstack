import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScriptProviderImporter, resolveScriptBase } from "./script-loader";

const FILES = {
  "hls-video": "playerstack-hls.abcd1234.js",
  "vimeo-video": "playerstack-vimeo.ef567890.js",
};

// happy-dom refuses to fetch scripts and fires `error` on append, so provider
// tags are captured instead of connected; tests fire load/error themselves.
let appended: HTMLScriptElement[] = [];

function injected(): HTMLScriptElement[] {
  return appended.filter((s) => s.dataset.removed === undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = "";
});

describe("resolveScriptBase", () => {
  it("uses the directory of the currently executing playerstack script", () => {
    const script = document.createElement("script");
    script.src = "https://cdn.example.com/assets/v2/playerstack.min.js?x=1";
    expect(resolveScriptBase(script, document)).toBe("https://cdn.example.com/assets/v2/");
  });

  it("falls back to the last playerstack <script> on the page when currentScript is null", () => {
    // Non-JS type keeps happy-dom from trying (and failing) to fetch them.
    document.head.innerHTML = `
      <script type="text/x-test" src="https://other.example.com/analytics.js"></script>
      <script type="text/x-test" src="https://playerstack.techskills.academy/playerstack.min.js"></script>`;
    expect(resolveScriptBase(null, document)).toBe("https://playerstack.techskills.academy/");
  });

  it("falls back to the document base when no playerstack <script> is found", () => {
    expect(resolveScriptBase(null, document)).toBe(new URL("./", document.baseURI).href);
  });
});

describe("createScriptProviderImporter", () => {
  const base = "https://cdn.example.com/assets/";

  beforeEach(() => {
    appended = [];
    vi.spyOn(document.head, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
      const script = node as unknown as HTMLScriptElement;
      script.remove = () => {
        script.dataset.removed = "";
      };
      appended.push(script);
      return node;
    });
  });

  it("injects one async <script> with the provider file next to the main script", () => {
    const importer = createScriptProviderImporter({ base, files: FILES, document });
    void importer("hls-video");
    const scripts = injected();
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe("https://cdn.example.com/assets/playerstack-hls.abcd1234.js");
    expect(scripts[0]?.async).toBe(true);
  });

  it("resolves when the script fires load", async () => {
    const importer = createScriptProviderImporter({ base, files: FILES, document });
    const done = importer("vimeo-video");
    injected()[0]?.dispatchEvent(new Event("load"));
    await expect(done).resolves.toBeUndefined();
  });

  it("rejects with the file URL when the script fails to load and removes the tag", async () => {
    const importer = createScriptProviderImporter({ base, files: FILES, document });
    const done = importer("hls-video");
    injected()[0]?.dispatchEvent(new Event("error"));
    await expect(done).rejects.toThrow("playerstack-hls.abcd1234.js");
    expect(injected()).toHaveLength(0);
  });

  it("rejects without a network request for a provider missing from the manifest", async () => {
    const importer = createScriptProviderImporter({ base, files: FILES, document });
    await expect(importer("twitch-video")).rejects.toThrow(/twitch-video/);
    expect(injected()).toHaveLength(0);
  });
});
