export interface YouTubeSource {
  type: "youtube";
  id: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const YT_PATH_PREFIXES = ["embed", "shorts", "v"] as const;

export function parseYouTube(input: string): YouTubeSource | null {
  if (!input) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (!YT_HOSTS.has(url.hostname)) return null;

  if (url.hostname === "youtu.be") {
    const id = url.pathname.replace(/^\/+/, "");
    return validId(id);
  }

  if (url.pathname === "/watch") {
    const v = url.searchParams.get("v");
    return v ? validId(v) : null;
  }

  for (const prefix of YT_PATH_PREFIXES) {
    if (url.pathname.startsWith(`/${prefix}/`)) {
      const id = url.pathname.slice(prefix.length + 2).replace(/\/.*$/, "");
      return validId(id);
    }
  }

  return null;
}

function validId(id: string): YouTubeSource | null {
  if (!YT_ID.test(id)) return null;
  return { type: "youtube", id };
}
