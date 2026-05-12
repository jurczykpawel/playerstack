import { parseYouTube, type YouTubeSource } from "./parsers/youtube";
import { parseVimeo, type VimeoSource } from "./parsers/vimeo";
import { parseWistia, type WistiaSource } from "./parsers/wistia";
import { parseTwitch, type TwitchSource } from "./parsers/twitch";
import { parseBunny, type BunnySource } from "./parsers/bunny";
import { parseFile, type FileSource } from "./parsers/file";

export type ResolvedSource =
  | YouTubeSource
  | VimeoSource
  | WistiaSource
  | TwitchSource
  | BunnySource
  | FileSource;

// Order matters: bunny must run before file so Bunny URLs are tagged with
// the provider metadata instead of falling through to the generic file parser.
const PARSERS = [
  parseYouTube,
  parseVimeo,
  parseWistia,
  parseTwitch,
  parseBunny,
  parseFile,
] as const;

export function resolveSource(input: string): ResolvedSource | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  for (const parser of PARSERS) {
    const result = parser(trimmed);
    if (result) return result;
  }
  return null;
}
