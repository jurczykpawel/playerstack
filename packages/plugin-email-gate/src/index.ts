import type { PlayerstackPlugin, PlayerstackContext } from "@playerstack/core";

export interface EmailGateConfig {
  enabled?: boolean;
  /** "before" shows form on init. A number is ALWAYS seconds. For percent use `atPercent`. */
  at?: "before" | number;
  /** Optional percent threshold (0-100) of duration. Mutually compatible with `at`. */
  atPercent?: number;
  webhookUrl?: string;
  /** Localstorage key prefix; defaults to "playerstack:email-gate". One slot per src. */
  storageKey?: string;
  /** Heading text inside the form. */
  title?: string;
  /** Submit button label. */
  buttonLabel?: string;
}

interface GateState {
  cleanup: () => void;
}

const states = new WeakMap<PlayerstackContext, GateState>();

export const emailGatePlugin: PlayerstackPlugin = {
  name: "email-gate",
  async init(ctx: PlayerstackContext): Promise<void> {
    const cfg = (ctx.config as { emailGate?: EmailGateConfig }).emailGate;
    if (!cfg?.enabled) return;

    const memoKey = `${cfg.storageKey ?? "playerstack:email-gate"}:${ctx.config.src}`;
    if (typeof localStorage !== "undefined" && localStorage.getItem(memoKey)) {
      return;
    }

    const at = cfg.at ?? "before";
    let shown = false;
    let removeTimeListener: (() => void) | null = null;

    const show = () => {
      if (shown) return;
      shown = true;
      removeTimeListener?.();
      removeTimeListener = null;

      const player = ctx.mediaPlayer as HTMLElement & { pause?: () => void };
      player.pause?.();
      const overlay = renderOverlay(cfg, ctx, memoKey);
      const wrapper = ensurePositionedParent(ctx.mediaPlayer);
      wrapper.appendChild(overlay);
    };

    if (at === "before") {
      show();
    } else {
      const seconds = typeof at === "number" ? at : undefined;
      const atPercent = cfg.atPercent;
      const onTime = () => {
        const player = ctx.mediaPlayer as HTMLElement & {
          currentTime?: number;
          duration?: number;
        };
        const t = player.currentTime ?? 0;
        const d = player.duration ?? 0;
        const triggerSeconds = seconds !== undefined && t >= seconds;
        const triggerPercent = atPercent !== undefined && d > 0 && (t / d) * 100 >= atPercent;
        if (triggerSeconds || triggerPercent) show();
      };
      ctx.mediaPlayer.addEventListener("timeupdate", onTime);
      removeTimeListener = () => ctx.mediaPlayer.removeEventListener("timeupdate", onTime);
    }

    states.set(ctx, {
      cleanup: () => {
        removeTimeListener?.();
        ctx.container.querySelector(".playerstack-email-gate")?.remove();
      },
    });
  },
  destroy(ctx: PlayerstackContext): void {
    states.get(ctx)?.cleanup();
    states.delete(ctx);
  },
};

function renderOverlay(
  cfg: EmailGateConfig,
  ctx: PlayerstackContext,
  memoKey: string,
): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "playerstack-email-gate";
  overlay.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);color:#fff;padding:24px;z-index:2;";

  const form = document.createElement("form");
  form.style.cssText = "display:grid;gap:12px;max-width:420px;width:100%;text-align:center;";

  const heading = document.createElement("h3");
  heading.textContent = cfg.title ?? "Watch the rest";
  heading.style.cssText = "margin:0;font-size:22px;font-weight:600;";
  form.appendChild(heading);

  const input = document.createElement("input");
  input.type = "email";
  input.required = true;
  input.placeholder = "you@example.com";
  input.style.cssText =
    "padding:10px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:#fff;font-size:15px;";
  form.appendChild(input);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = cfg.buttonLabel ?? "Continue watching →";
  submit.style.cssText =
    "padding:10px 16px;border-radius:6px;border:none;background:var(--ps-accent,#008aff);color:#fff;font-weight:600;cursor:pointer;";
  form.appendChild(submit);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!email || !input.checkValidity()) return;

    ctx.events.emit("email-gate:submit", { email });

    if (cfg.webhookUrl && typeof fetch !== "undefined") {
      void fetch(cfg.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, src: ctx.config.src }),
      }).catch(() => {
        /* lead capture should not break playback */
      });
    }

    if (typeof localStorage !== "undefined") {
      localStorage.setItem(memoKey, new Date().toISOString());
    }

    overlay.remove();
    const player = ctx.mediaPlayer as HTMLElement & { play?: () => Promise<void> | void };
    try {
      const result = player.play?.();
      if (result instanceof Promise) result.catch(() => {});
    } catch {
      /* play() not available before hydration — ignore */
    }
  });

  overlay.appendChild(form);
  return overlay;
}

function ensurePositionedParent(mediaPlayer: HTMLElement): HTMLElement {
  const parent = mediaPlayer.parentElement;
  if (parent) {
    if (!parent.style.position) parent.style.position = "relative";
    return parent;
  }
  return mediaPlayer;
}
