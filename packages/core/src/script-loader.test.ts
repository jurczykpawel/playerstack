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
  // A detached document: happy-dom fetches no scripts there, so real JS types can be used.
  function page(html: string): Document {
    const doc = document.implementation.createHTMLDocument("");
    doc.head.innerHTML = html;
    return doc;
  }
  const CDN = "https://cdn.example.com/assets/v2/playerstack.min.js";

  it("uses the directory of the currently executing playerstack script", () => {
    const script = document.createElement("script");
    script.src = "https://cdn.example.com/assets/v2/playerstack.min.js?x=1";
    expect(resolveScriptBase(script, document)).toBe("https://cdn.example.com/assets/v2/");
  });

  it("falls back to the last playerstack <script> on the page when currentScript is null", () => {
    const doc = page(`
      <script src="https://other.example.com/analytics.js"></script>
      <script src="https://playerstack.techskills.academy/playerstack.min.js"></script>`);
    expect(resolveScriptBase(null, doc)).toBe("https://playerstack.techskills.academy/");
  });

  it("prefers data-provider-base on the executing script (renamed copy)", () => {
    document.head.innerHTML = `<script type="text/x-test" src="https://example.com/wp-content/cache/min/bundle-1a2b.js" data-provider-base="https://cdn.example.com/playerstack/"></script>`;
    const script = document.head.querySelector("script")!;
    expect(resolveScriptBase(script, document)).toBe("https://cdn.example.com/playerstack/");
  });

  it("reads data-provider-base from any JavaScript <script> when currentScript is null (module)", () => {
    const doc = page(`
      <script src="https://playerstack.techskills.academy/playerstack.min.js"></script>
      <script data-provider-base="/static/ps"></script>`);
    // Relative values resolve against the page; a missing trailing slash is added.
    expect(resolveScriptBase(null, doc)).toBe(new URL("/static/ps/", doc.baseURI).href);
  });

  it("ignores data-provider-base on other elements while the executing script has a src", () => {
    const doc = page(`
      <script src="${CDN}"></script>
      <script type="text/plain" data-provider-base="https://attacker.test/"></script>
      <script data-provider-base="https://attacker.test/js/"></script>`);
    const current = doc.querySelector("script")!;
    expect(resolveScriptBase(current, doc)).toBe("https://cdn.example.com/assets/v2/");
  });

  it("reads data-provider-base from another JavaScript <script> for an inlined copy", () => {
    const doc = page(`
      <script id="inline">/* inlined bundle */</script>
      <script type="text/plain" data-provider-base="https://attacker.test/"></script>
      <script data-provider-base="https://cdn.example.com/ps/"></script>`);
    expect(resolveScriptBase(doc.querySelector("#inline"), doc)).toBe(
      "https://cdn.example.com/ps/",
    );
  });

  it("does not take data-provider-base from inert or SVG scripts when currentScript is null", () => {
    const doc = page(`
      <script type="application/ld+json" data-provider-base="https://attacker.test/a/"></script>
      <script type="text/plain" data-provider-base="https://attacker.test/b/"></script>`);
    doc.body.innerHTML = `<svg><script data-provider-base="https://attacker.test/c/"></script></svg>`;
    expect(resolveScriptBase(null, doc)).toBe(new URL("./", doc.baseURI).href);
  });

  it("does not take the playerstack fallback from an inert script", () => {
    const doc = page(`
      <script src="https://playerstack.techskills.academy/playerstack.min.js"></script>
      <script type="text/plain" src="https://attacker.test/playerstack.js"></script>`);
    expect(resolveScriptBase(null, doc)).toBe("https://playerstack.techskills.academy/");
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
