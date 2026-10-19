import type { LazyMediaElementTag, ProviderImporter } from "./providers";

const MAIN_SCRIPT_RE = /\/playerstack(?:\.min)?\.js(?:[?#]|$)/;

/**
 * Directory the standalone script was served from, so provider files can be
 * fetched next to it. Pass `document.currentScript` captured at top-level
 * evaluation: it is null in callbacks and for module scripts.
 */
export function resolveScriptBase(current: HTMLOrSVGScriptElement | null, doc: Document): string {
  let src = current instanceof HTMLScriptElement ? current.src : "";
  if (!src) {
    const candidates = [...doc.querySelectorAll<HTMLScriptElement>("script[src]")].filter((s) =>
      MAIN_SCRIPT_RE.test(s.src),
    );
    src = candidates[candidates.length - 1]?.src ?? "";
  }
  return new URL("./", src || doc.baseURI).href;
}

export interface ScriptProviderImporterOptions {
  base: string;
  files: Partial<Record<LazyMediaElementTag, string>>;
  document: Document;
}

/** Loads a provider by appending `<script async src="{base}{file}">`. */
export function createScriptProviderImporter({
  base,
  files,
  document: doc,
}: ScriptProviderImporterOptions): ProviderImporter {
  return (tag) => {
    const file = files[tag];
    if (!file) return Promise.reject(new Error(`no provider file for <${tag}>`));
    const url = new URL(file, base).href;
    return new Promise<void>((resolve, reject) => {
      const script = doc.createElement("script");
      script.async = true;
      script.src = url;
      script.dataset.playerstackProvider = tag;
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener(
        "error",
        () => {
          script.remove();
          reject(new Error(`failed to load ${url}`));
        },
        { once: true },
      );
      doc.head.appendChild(script);
    });
  };
}
