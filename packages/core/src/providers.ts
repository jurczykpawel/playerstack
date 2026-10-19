import { importProvider } from "./provider-imports";

/** Tag name a plugin can request the inner media element to use. */
export type MediaElementTag =
  "video" | "youtube-video" | "vimeo-video" | "hls-video" | "wistia-video" | "twitch-video";

/** Media elements that are not part of the core bundle and load on first use. */
export type LazyMediaElementTag = "hls-video" | "vimeo-video" | "wistia-video" | "twitch-video";

/** Loads the code that defines a lazy media element. */
export type ProviderImporter = (tag: LazyMediaElementTag) => Promise<unknown>;

/** Every release must ship a provider file for each of these (see packages/embed/build.ts). */
export const LAZY_MEDIA_ELEMENT_TAGS: readonly LazyMediaElementTag[] = [
  "hls-video",
  "vimeo-video",
  "wistia-video",
  "twitch-video",
];
const LAZY_TAGS: readonly string[] = LAZY_MEDIA_ELEMENT_TAGS;

let importer: ProviderImporter = importProvider;
const pending = new Map<LazyMediaElementTag, Promise<void>>();

export function isLazyMediaElement(tag: string): tag is LazyMediaElementTag {
  return LAZY_TAGS.includes(tag);
}

/**
 * Replace how provider code is loaded. The npm build uses dynamic `import()`;
 * the standalone script swaps in a loader that fetches sibling files.
 */
export function setProviderImporter(next: ProviderImporter): void {
  importer = next;
  pending.clear();
}

/**
 * Resolves once `tag` is a defined custom element. Native `<video>` and YouTube
 * resolve immediately; other providers are loaded once and shared by every
 * player on the page. A failed load is forgotten so the next player retries.
 */
export function ensureMediaElement(tag: MediaElementTag): Promise<void> {
  if (!isLazyMediaElement(tag) || customElements.get(tag)) return Promise.resolve();
  let loading = pending.get(tag);
  if (!loading) {
    loading = Promise.resolve()
      .then(() => importer(tag))
      .then(() => {
        if (!customElements.get(tag)) {
          throw new Error(`provider loaded but <${tag}> is not defined`);
        }
      });
    loading.catch(() => pending.delete(tag));
    pending.set(tag, loading);
  }
  return loading;
}

export function _resetProvidersForTesting(): void {
  importer = importProvider;
  pending.clear();
}
