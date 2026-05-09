import { parseYouTube, type YouTubeSource } from "./parsers/youtube";
import { parseVimeo, type VimeoSource } from "./parsers/vimeo";
import { parseFile, type FileSource } from "./parsers/file";

export type ResolvedSource = YouTubeSource | VimeoSource | FileSource;

const PARSERS = [parseYouTube, parseVimeo, parseFile] as const;

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
