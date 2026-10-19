import { createScriptProviderImporter, resolveScriptBase } from "@playerstack/core/script-loader";
import type { LazyMediaElementTag } from "@playerstack/core";

// Filled in by build.ts with the hashed provider file names.
declare const __PLAYERSTACK_PROVIDER_FILES__: Partial<Record<LazyMediaElementTag, string>>;

// Replaces @playerstack/core's provider-imports.ts in the standalone build.
// Evaluated while playerstack.min.js itself executes, the only moment
// document.currentScript points at it.
export const importProvider = createScriptProviderImporter({
  base: resolveScriptBase(document.currentScript, document),
  files: __PLAYERSTACK_PROVIDER_FILES__,
  document,
});
