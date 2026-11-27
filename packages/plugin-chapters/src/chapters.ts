export interface ChapterPoint {
  time: number;
  label: string;
}

export type JumpToChapter = (point: ChapterPoint) => void;

export function mediaTime(media: HTMLElement): number {
  return (media as HTMLElement & { currentTime?: number }).currentTime ?? 0;
}

/** Index of the last chapter starting at or before `time`, or -1. Expects sorted points. */
export function chapterIndexAt(points: readonly ChapterPoint[], time: number): number {
  for (let i = points.length - 1; i >= 0; i--) {
    if (time >= points[i]!.time) return i;
  }
  return -1;
}

export function chapterText(point: ChapterPoint): string {
  const m = Math.floor(point.time / 60);
  const s = String(Math.floor(point.time % 60)).padStart(2, "0");
  return `${m}:${s}  ${point.label}`;
}
