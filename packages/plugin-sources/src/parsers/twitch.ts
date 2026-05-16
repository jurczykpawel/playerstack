export type TwitchKind = "video" | "channel" | "clip";

export interface TwitchSource {
  type: "twitch";
  kind: TwitchKind;
  id: string;
}

const TWITCH_HOSTS = new Set([
  "twitch.tv",
  "www.twitch.tv",
  "go.twitch.tv",
  "player.twitch.tv",
  "clips.twitch.tv",
]);
const VIDEO_ID = /^[0-9]+$/;
const CHANNEL_NAME = /^[A-Za-z0-9_]{3,25}$/;
const CLIP_SLUG = /^[A-Za-z0-9_-]{6,80}$/;

export function parseTwitch(input: string): TwitchSource | null {
  if (!input) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!TWITCH_HOSTS.has(url.hostname.toLowerCase())) return null;

  // clips.twitch.tv/{slug}
  if (url.hostname === "clips.twitch.tv") {
    const slug = url.pathname.replace(/^\/+/, "");
    return CLIP_SLUG.test(slug) ? { type: "twitch", kind: "clip", id: slug } : null;
  }

  // player.twitch.tv/?video=… or ?channel=…
  if (url.hostname === "player.twitch.tv") {
    const video = url.searchParams.get("video");
    if (video && VIDEO_ID.test(video)) return { type: "twitch", kind: "video", id: video };
    const channel = url.searchParams.get("channel");
    if (channel && CHANNEL_NAME.test(channel))
      return { type: "twitch", kind: "channel", id: channel };
    return null;
  }

  // twitch.tv/videos/{id}
  const videoId = /^\/videos\/([0-9]+)/.exec(url.pathname)?.[1];
  if (videoId) return { type: "twitch", kind: "video", id: videoId };

  // twitch.tv/{channel}/clip/{slug}
  const clipSlug = /^\/([A-Za-z0-9_]{3,25})\/clip\/([A-Za-z0-9_-]{6,80})/.exec(url.pathname)?.[2];
  if (clipSlug) return { type: "twitch", kind: "clip", id: clipSlug };

  // twitch.tv/{channel}
  const channel = /^\/([A-Za-z0-9_]{3,25})$/.exec(url.pathname.replace(/\/$/, ""))?.[1];
  if (channel) return { type: "twitch", kind: "channel", id: channel };

  return null;
}
