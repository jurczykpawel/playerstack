export type FileType = "mp4" | "hls" | "webm" | "dash";

export interface FileSource {
  type: FileType;
  vidstackSrc: string;
}

const EXT_MAP: Record<string, FileType> = {
  mp4: "mp4",
  m3u8: "hls",
  webm: "webm",
  mpd: "dash",
};

export function parseFile(input: string): FileSource | null {
  if (!input) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const dot = url.pathname.lastIndexOf(".");
  if (dot < 0) return null;

  const ext = url.pathname.slice(dot + 1).toLowerCase();
  const type = EXT_MAP[ext];
  if (!type) return null;

  return { type, vidstackSrc: input };
}
