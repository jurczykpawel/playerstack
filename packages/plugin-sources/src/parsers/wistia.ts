export interface WistiaSource {
  type: "wistia";
  id: string;
}

// Wistia hashed IDs are alphanumeric, ~10 chars. Mux's wistia-video-element
// regex matches `(wistia.com|wi.st)/(medias|embed)/(.*)` and forwards whatever
// comes after that path segment, but we validate against the documented shape.
const WISTIA_HOST = /(?:^|\.)wistia\.com$/i;
const WISTIA_SHORT_HOST = /^wi\.st$/i;
const WISTIA_ID = /^[A-Za-z0-9]{6,16}$/;
const WISTIA_PATH = /^\/(?:medias|embed(?:\/iframe|\/medias)?)\/([A-Za-z0-9]{6,16})(?:\/|$)/;

export function parseWistia(input: string): WistiaSource | null {
  if (!input) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!WISTIA_HOST.test(url.hostname) && !WISTIA_SHORT_HOST.test(url.hostname)) return null;

  const match = WISTIA_PATH.exec(url.pathname);
  if (!match) return null;

  const id = match[1];
  if (!WISTIA_ID.test(id)) return null;

  return { type: "wistia", id };
}
