import type { LazyMediaElementTag, ProviderImporter } from "./providers";

const MAIN_SCRIPT_RE = /\/playerstack(?:\.min)?\.js(?:[?#]|$)/;

/** HTML scripts that run as JavaScript: inert types and SVG scripts are page content. */
const isJsScript = (el: Element): el is HTMLScriptElement =>
  el instanceof HTMLScriptElement &&
  (!el.type || /^(module|(text|application)\/(java|ecma)script)$/i.test(el.type));

/**
 * Directory the standalone script was served from, so provider files can be
 * fetched next to it. Pass `document.currentScript` captured at top-level
 * evaluation: it is null in callbacks and for module scripts.
 * `data-provider-base` sets the directory by hand for renamed, inlined, module
 * or combined copies. Only the executing script's own attribute counts when it
 * has a `src`; other scripts on the page are read only without one, so injected
 * markup cannot choose where code is loaded from.
 */
export function resolveScriptBase(current: HTMLOrSVGScriptElement | null, doc: Document): string {
  const own = current instanceof HTMLScriptElement ? current : null;
  let manual = own?.dataset.providerBase;
  let src = own?.src ?? "";
  if (!manual && !src) {
    const scripts = [...doc.querySelectorAll("script")].filter(isJsScript);
    manual = scripts.find((s) => s.dataset.providerBase)?.dataset.providerBase;
    src = scripts.filter((s) => MAIN_SCRIPT_RE.test(s.src)).pop()?.src ?? "";
  }
  if (manual) return new URL(manual.replace(/\/?$/, "/"), doc.baseURI).href;
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
