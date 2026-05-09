export interface VimeoSource {
  type: "vimeo";
  id: string;
  hash?: string;
}

const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const NUMERIC = /^\d+$/;
const HASH = /^[a-z0-9]+$/i;

export function parseVimeo(input: string): VimeoSource | null {
  if (!input) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (!VIMEO_HOSTS.has(url.hostname)) return null;

  const segments = url.pathname.split("/").filter(Boolean);

  if (url.hostname === "player.vimeo.com" && segments[0] === "video" && segments[1]) {
    return build(segments[1], segments[2]);
  }

  if (segments.length >= 1 && NUMERIC.test(segments[0] ?? "")) {
    return build(segments[0] ?? "", segments[1]);
  }

  return null;
}

function build(id: string, hash?: string): VimeoSource | null {
  if (!NUMERIC.test(id)) return null;
  const result: VimeoSource = { type: "vimeo", id };
  if (hash && HASH.test(hash)) result.hash = hash;
  return result;
}
