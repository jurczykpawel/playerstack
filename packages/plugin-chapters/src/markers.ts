import { chapterIndexAt, mediaTime, type ChapterPoint, type JumpToChapter } from "./chapters";

// How far from a marker a click still counts as a click on it, and how far the
// pointer may travel before the gesture is a drag.
const MARKER_REACH_PX = 6;
const DRAG_PX = 4;

type TimeRange = HTMLElement & {
  range?: HTMLInputElement;
  mediaChaptersCues?: { text: string; startTime: number; endTime: number }[];
  updateBar?: () => void;
};

/**
 * Chapter segments, titles and marker clicks on <media-time-range>. Nothing is
 * layered over the bar, so seeking and dragging stay with media-chrome.
 */
export function mountMarkers(
  container: HTMLElement,
  media: HTMLElement,
  points: readonly ChapterPoint[],
  jump: JumpToChapter,
): () => void {
  const timeRange = container.querySelector<TimeRange>("media-time-range");
  if (!timeRange) return () => {};
  const range = timeRange.range;
  const labelAt = (time: number) => points[chapterIndexAt(points, time)]?.label ?? "";
  const preview = () =>
    timeRange.shadowRoot?.querySelector<HTMLElement & { mediaPreviewChapter?: string }>(
      "media-preview-chapter-display",
    );

  // media-chrome redraws these segments whenever the duration changes.
  timeRange.mediaChaptersCues = points.map((point, i) => ({
    text: point.label,
    startTime: point.time,
    endTime: points[i + 1]?.time ?? Infinity,
  }));

  // media-controller answers the same request without a title (the media has no
  // chapters track); listening above it lets the title be written afterwards.
  const onPreview = (event: Event) => {
    const time = (event as CustomEvent<number | null>).detail;
    const display = preview();
    if (time != null && display) display.mediaPreviewChapter = labelAt(time);
  };

  // The hover preview needs a pointer; keyboard users get the title at the playhead.
  const title = document.createElement("div");
  title.slot = "current";
  title.className = "playerstack-chapter-title";
  title.hidden = true;
  title.setAttribute("aria-hidden", "true");
  title.style.cssText =
    "pointer-events:none;white-space:nowrap;padding:3px 9px;border-radius:4px;font-size:13px;" +
    "line-height:17px;color:#fff;background:var(--media-secondary-color,rgb(20 20 30 / .85));";
  timeRange.appendChild(title);

  const showTitle = () => {
    const label = labelAt(mediaTime(media));
    const hidden = !label || !range?.matches(":focus-visible");
    if (title.hidden === hidden && title.textContent === label) return;
    title.textContent = label;
    title.hidden = hidden;
    if (!hidden) timeRange.updateBar?.();
  };
  const hideTitle = () => {
    title.hidden = true;
  };

  let plainText: string | null = null;
  let chapterValueText: string | null = null;
  const describe = () => {
    const value = range!.getAttribute("aria-valuetext");
    if (value === null || value === chapterValueText) return;
    const label = labelAt(mediaTime(media));
    plainText = value;
    chapterValueText = label ? `${value}, ${label}` : value;
    if (label) range!.setAttribute("aria-valuetext", chapterValueText);
  };
  const observer = new MutationObserver(describe);
  if (range) observer.observe(range, { attributeFilter: ["aria-valuetext"] });

  let downX: number | null = null;
  const onPointerDown = (event: MouseEvent) => {
    downX = event.clientX;
  };
  const onClick = (event: MouseEvent) => {
    const start = downX;
    downX = null;
    if (start === null || Math.abs(event.clientX - start) > DRAG_PX) return;
    const box = range?.getBoundingClientRect();
    const duration = (media as HTMLElement & { duration?: number }).duration;
    if (!box || !duration || !Number.isFinite(duration)) return;
    const distance = (point: ChapterPoint) =>
      Math.abs(event.clientX - box.left - (point.time / duration) * box.width);
    const nearest = points
      .filter((point) => point.time < duration)
      .sort((a, b) => distance(a) - distance(b))[0];
    if (nearest && distance(nearest) <= MARKER_REACH_PX) jump(nearest);
  };

  container.addEventListener("mediapreviewrequest", onPreview);
  timeRange.addEventListener("focusin", showTitle);
  timeRange.addEventListener("keydown", showTitle);
  timeRange.addEventListener("focusout", hideTitle);
  timeRange.addEventListener("pointerdown", onPointerDown);
  timeRange.addEventListener("click", onClick);
  media.addEventListener("timeupdate", showTitle);

  return () => {
    container.removeEventListener("mediapreviewrequest", onPreview);
    timeRange.removeEventListener("focusin", showTitle);
    timeRange.removeEventListener("keydown", showTitle);
    timeRange.removeEventListener("focusout", hideTitle);
    timeRange.removeEventListener("pointerdown", onPointerDown);
    timeRange.removeEventListener("click", onClick);
    media.removeEventListener("timeupdate", showTitle);
    observer.disconnect();
    if (plainText !== null && range?.getAttribute("aria-valuetext") === chapterValueText) {
      range.setAttribute("aria-valuetext", plainText);
    }
    title.remove();
    timeRange.mediaChaptersCues = [];
  };
}
