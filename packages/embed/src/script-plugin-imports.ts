import type { LazyPluginName } from "../plugin-manifest";
import type { PluginImporter } from "./lazy-plugins";
import { pluginModules } from "./plugin-modules";

export function createScriptPluginImporter({
  base,
  files,
  document: doc,
}: {
  base: string;
  files: Partial<Record<LazyPluginName, string>>;
  document: Document;
}): PluginImporter {
  return (name) => {
    const file = files[name];
    if (!file) return Promise.reject(new Error(`no plugin file for ${name}`));
    const url = new URL(file, base).href;
    const existing = pluginModules().get(url);
    if (existing?.name === name) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      script.async = true;
      script.src = url;
      script.dataset.playerstackPlugin = name;
      const fail = (message: string) => {
        clearTimeout(timer);
        script.remove();
        reject(new Error(message));
      };
      const timer = setTimeout(() => fail(`plugin ${name} timed out loading ${url}`), 15000);
      script.addEventListener(
        "load",
        () => {
          clearTimeout(timer);
          const plugin = pluginModules().get(url);
          if (plugin?.name !== name) {
            fail(`script did not register ${name}: ${url}`);
            return;
          }
          resolve(plugin);
        },
        { once: true },
      );
      script.addEventListener("error", () => fail(`failed to load plugin ${name}: ${url}`), {
        once: true,
      });
      doc.head.appendChild(script);
    });
  };
}
