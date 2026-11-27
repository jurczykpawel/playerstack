import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";
import { chapterIndexAt, chapterText, mediaTime, type ChapterPoint } from "./chapters";
import { mountMarkers } from "./markers";
import { mountMenu } from "./menu";

export type { ChapterPoint } from "./chapters";

export interface ChaptersConfig {
  points: ChapterPoint[];
  /** Optional CSS selector to mount the chapter list outside the player. */
  containerSelector?: string;
  /** Show chapter segments and titles on the progress bar (default: false). */
  markers?: boolean;
  /** Add a chapters button with a menu to the control bar (default: false). */
  menu?: boolean;
  /** Accessible name of the menu button (default: "Chapters"). Set it in the page language. */
  menuLabel?: string;
}

interface ChapterState {
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, ChapterState>();

export const chaptersPlugin: PlayerstackPlugin = {
  name: "chapters",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { chapters?: ChaptersConfig }).chapters;
    if (!cfg?.points?.length) return;

    const list = document.createElement("ol");
    list.className = "playerstack-chapters";
    list.style.cssText =
      "list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px;font-family:inherit;";

    const points = cfg.points.slice().sort((a, b) => a.time - b.time);
    const buttons: HTMLButtonElement[] = [];
    const jump = (point: ChapterPoint) => {
      const player = ctx.mediaPlayer as HTMLElement & { currentTime?: number };
      if ("currentTime" in player) player.currentTime = point.time;
      ctx.events.emit("chapter:jump", point);
    };

    points.forEach((point) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "playerstack-chapter";
      btn.textContent = chapterText(point);
      btn.style.cssText =
        "width:100%;text-align:left;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:inherit;cursor:pointer;font:inherit;";
      btn.addEventListener("click", () => jump(point));
      buttons.push(btn);
      li.appendChild(btn);
      list.appendChild(li);
    });

    const onTime = () => {
      const activeIdx = Math.max(0, chapterIndexAt(points, mediaTime(ctx.mediaPlayer)));
      buttons.forEach((b, i) => b.classList.toggle("active", i === activeIdx));
    };
    ctx.mediaPlayer.addEventListener("timeupdate", onTime);

    // <player-stack> has overflow:hidden + aspect-ratio:16/9 default styles
    // (see core/playerstack-element DEFAULT_STYLES), so mounting inside would
    // clip the list out of view. Default placement: as a sibling immediately
    // after <player-stack>. The caller can opt into a custom mount via
    // `containerSelector`.
    const customTarget = cfg.containerSelector
      ? document.querySelector<HTMLElement>(cfg.containerSelector)
      : null;
    if (customTarget) {
      customTarget.appendChild(list);
    } else {
      ctx.container.insertAdjacentElement("afterend", list);
    }

    const timed = points.filter((point) => Number.isFinite(point.time) && point.time >= 0);
    const unmount: (() => void)[] = [];
    if (cfg.markers && timed.length) {
      unmount.push(mountMarkers(ctx.container, ctx.mediaPlayer, timed, jump));
    }
    if (cfg.menu && timed.length) {
      const label = cfg.menuLabel || "Chapters";
      unmount.push(mountMenu(ctx.container, ctx.mediaPlayer, timed, label, jump));
    }

    states.set(ctx, {
      cleanup: () => {
        unmount.forEach((remove) => remove());
        ctx.mediaPlayer.removeEventListener("timeupdate", onTime);
        list.remove();
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};
