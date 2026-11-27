import {
  chapterIndexAt,
  chapterText,
  mediaTime,
  type ChapterPoint,
  type JumpToChapter,
} from "./chapters";

let nextId = 0;

/** A disclosure button in the control bar that lists the chapters above it. */
export function mountMenu(
  container: HTMLElement,
  media: HTMLElement,
  points: readonly ChapterPoint[],
  label: string,
  jump: JumpToChapter,
): () => void {
  const controller = container.querySelector("media-controller");
  const bar = controller?.querySelector("media-control-bar");
  if (!controller || !bar) return () => {};

  const panel = document.createElement("div");
  panel.id = `playerstack-chapters-menu-${++nextId}`;
  panel.className = "playerstack-chapters-menu";
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", label);
  panel.hidden = true;
  // Keeps an open menu from fading out with the inactive controls.
  panel.setAttribute("noautohide", "");
  panel.style.cssText =
    "position:absolute;right:8px;bottom:52px;z-index:2;box-sizing:border-box;padding:4px;" +
    "pointer-events:auto;" +
    "max-width:calc(100% - 16px);max-height:calc(100% - 60px);overflow:auto;border-radius:6px;" +
    "font:14px/20px system-ui,sans-serif;color:#fff;background:rgb(20 20 30 / .94);";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "playerstack-chapters-toggle";
  toggle.title = label;
  toggle.setAttribute("aria-label", label);
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", panel.id);
  toggle.setAttribute("keysused", "Space Enter");
  toggle.style.cssText =
    "display:inline-flex;flex:none;align-items:center;justify-content:center;width:44px;" +
    "height:44px;padding:0;border:0;cursor:pointer;pointer-events:auto;" +
    "color:var(--media-primary-color,#fff);" +
    "background:var(--media-control-background,var(--media-secondary-color,rgb(20 20 30 / .7)));";
  toggle.innerHTML =
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">' +
    '<path d="M3 5h2v2H3zm4 0h14v2H7zM3 11h2v2H3zm4 0h14v2H7zM3 17h2v2H3zm4 0h14v2H7z"/></svg>';

  const close = (refocus: boolean) => {
    if (panel.hidden) return;
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (refocus) toggle.focus();
  };

  const items = points.map((point) => {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = chapterText(point);
    item.style.cssText =
      "display:block;width:100%;min-height:32px;padding:6px 10px;border:0;border-radius:4px;" +
      "text-align:left;white-space:pre-wrap;cursor:pointer;font:inherit;color:inherit;" +
      "background:transparent;";
    item.addEventListener("click", () => {
      jump(point);
      close(true);
    });
    panel.appendChild(item);
    return item;
  });

  const mark = () => {
    const current = chapterIndexAt(points, mediaTime(media));
    items.forEach((item, i) => {
      if (i === current) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
      item.style.background = i === current ? "rgb(255 255 255 / .18)" : "transparent";
    });
    return current;
  };

  toggle.addEventListener("click", () => {
    if (!panel.hidden) return close(true);
    const current = mark();
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    items[Math.max(0, current)]?.focus();
  });

  const inside = (target: EventTarget) => target === toggle || target === panel;
  const onKeyDown = (event: Event) => {
    const { key } = event as KeyboardEvent;
    // media-controller cancels Space for its own controls, and with it the button press.
    if (key === " ") event.stopPropagation();
    if (key !== "Escape" || panel.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  };
  const onFocusOut = (event: Event) => {
    const next = (event as FocusEvent).relatedTarget as Node | null;
    // An ancestor takes focus when Safari handles a press on one of these buttons;
    // presses elsewhere are covered by onOutsidePress.
    if (next && next !== toggle && !panel.contains(next) && !next.contains(panel)) close(false);
  };
  const onOutsidePress = (event: Event) => {
    if (!event.composedPath().some(inside)) close(false);
  };
  const onTime = () => {
    if (!panel.hidden) mark();
  };
  for (const element of [toggle, panel]) {
    element.addEventListener("keydown", onKeyDown);
    element.addEventListener("focusout", onFocusOut);
  }
  document.addEventListener("pointerdown", onOutsidePress);
  media.addEventListener("timeupdate", onTime);

  bar.insertBefore(toggle, bar.querySelector(":scope > media-fullscreen-button"));
  // Only the controller and its children are visible in fullscreen.
  controller.appendChild(panel);

  return () => {
    document.removeEventListener("pointerdown", onOutsidePress);
    media.removeEventListener("timeupdate", onTime);
    toggle.remove();
    panel.remove();
  };
}
