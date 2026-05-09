import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export interface ChapterPoint {
  time: number;
  label: string;
}

export interface ChaptersConfig {
  points: ChapterPoint[];
  /** Optional CSS selector to mount the chapter list outside the player. */
  containerSelector?: string;
}

interface ChapterState {
  list: HTMLElement;
  buttons: HTMLButtonElement[];
  points: ChapterPoint[];
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

    points.forEach((point) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "playerstack-chapter";
      btn.textContent = `${formatTime(point.time)}  ${point.label}`;
      btn.style.cssText =
        "width:100%;text-align:left;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:inherit;cursor:pointer;font:inherit;";
      btn.addEventListener("click", () => {
        const player = ctx.mediaPlayer as HTMLElement & { currentTime?: number };
        if ("currentTime" in player) player.currentTime = point.time;
        ctx.events.emit("chapter:jump", point);
      });
      buttons.push(btn);
      li.appendChild(btn);
      list.appendChild(li);
    });

    const onTime = () => {
      const player = ctx.mediaPlayer as HTMLElement & { currentTime?: number };
      const t = player.currentTime ?? 0;
      let activeIdx = 0;
      for (let i = points.length - 1; i >= 0; i--) {
        if (t >= (points[i]?.time ?? 0)) {
          activeIdx = i;
          break;
        }
      }
      buttons.forEach((b, i) => b.classList.toggle("active", i === activeIdx));
    };
    ctx.mediaPlayer.addEventListener("timeupdate", onTime);

    const mountTarget = cfg.containerSelector
      ? document.querySelector<HTMLElement>(cfg.containerSelector)
      : null;
    (mountTarget ?? ctx.container).appendChild(list);

    states.set(ctx, {
      list,
      buttons,
      points,
      cleanup: () => {
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

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = String(Math.floor(t % 60)).padStart(2, "0");
  return `${m}:${s}`;
}
