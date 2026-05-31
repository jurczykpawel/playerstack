import { isSafeHttpUrl, type PlayerstackPlugin, type PlayerstackContext } from "@playerstack/core";
import { solveChallenge } from "altcha-lib";
import type { LeadsChallenge, LeadsSubmission } from "./types";

export type { LeadsChallenge, LeadsSubmission } from "./types";

export interface EmailGateConfig {
  enabled?: boolean;
  /** "before" shows form on init. A number is ALWAYS seconds. For percent use `atPercent`. */
  at?: "before" | number;
  /** Optional percent threshold (0-100) of duration. */
  atPercent?: number;
  /**
   * Where to POST the LeadsSubmission. REQUIRED together with `challengeUrl`.
   * Without both, the plugin runs in "open" mode — emits `email-gate:submit` on
   * the event bus only, no network call.
   */
  webhookUrl?: string;
  /**
   * Where to GET the LeadsChallenge from. REQUIRED whenever `webhookUrl` is set.
   * Without it, the plugin REFUSES to render — secure-by-default.
   */
  challengeUrl?: string;
  /** Localstorage key prefix. One slot per src. */
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

    // Both URLs are required together. Plugin will not render with just one.
    if (cfg.webhookUrl && !cfg.challengeUrl) {
      console.error(
        "[playerstack] email-gate: `webhookUrl` requires `challengeUrl`. Plugin disabled. " +
          "See https://playerstack.techskills.academy/docs/email-gate for the contract.",
      );
      return;
    }

    // If either URL is configured, both must be parseable http(s) URLs.
    // Mixed / invalid URLs disable the plugin entirely — no partial fetches.
    if (cfg.webhookUrl || cfg.challengeUrl) {
      if (!isSafeHttpUrl(cfg.webhookUrl) || !isSafeHttpUrl(cfg.challengeUrl)) {
        console.error(
          "[playerstack] email-gate: `webhookUrl` and `challengeUrl` must both be http(s) URLs. Plugin disabled.",
        );
        return;
      }
    }

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
      ctx.container.appendChild(overlay);
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
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(0,0,0,0.85);color:#fff;padding:24px;z-index:3;";

  const form = document.createElement("form");
  form.style.cssText = "display:grid;gap:12px;max-width:420px;width:100%;text-align:center;";

  const heading = document.createElement("h3");
  heading.textContent = cfg.title ?? "Watch the rest";
  heading.style.cssText = "margin:0;font-size:22px;font-weight:600;";
  form.appendChild(heading);

  const input = document.createElement("input");
  input.type = "email";
  input.name = "email";
  input.required = true;
  input.placeholder = "you@example.com";
  input.autocomplete = "email";
  input.style.cssText =
    "padding:10px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);" +
    "background:rgba(255,255,255,0.05);color:#fff;font-size:15px;";
  form.appendChild(input);

  // Honeypot — invisible field. Bots fill every input; humans don't see this.
  const honey = document.createElement("input");
  honey.type = "text";
  honey.name = "website";
  honey.tabIndex = -1;
  honey.autocomplete = "off";
  honey.setAttribute("aria-hidden", "true");
  honey.style.cssText = "position:absolute;left:-10000px;opacity:0;pointer-events:none;";
  form.appendChild(honey);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = cfg.buttonLabel ?? "Continue watching →";
  submit.style.cssText =
    "padding:10px 16px;border-radius:6px;border:none;background:var(--ps-accent,#008aff);" +
    "color:#fff;font-weight:600;cursor:pointer;";
  form.appendChild(submit);

  const status = document.createElement("p");
  status.className = "playerstack-email-gate-status";
  status.style.cssText = "margin:0;font-size:13px;min-height:1.2em;opacity:0.85;";
  form.appendChild(status);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (honey.value) {
      // Bot tripped the honeypot. Pretend success silently — no signal back.
      overlay.remove();
      return;
    }
    const email = input.value.trim();
    if (!email || !input.checkValidity()) return;

    submit.disabled = true;
    status.textContent = "Verifying…";

    void handleSubmit({ cfg, ctx, memoKey, email, overlay, status, submit }).catch((err) => {
      submit.disabled = false;
      status.textContent =
        err instanceof Error ? `Sorry — ${err.message}` : "Sorry — verification failed.";
    });
  });

  overlay.appendChild(form);
  return overlay;
}

interface SubmitArgs {
  cfg: EmailGateConfig;
  ctx: PlayerstackContext;
  memoKey: string;
  email: string;
  overlay: HTMLElement;
  status: HTMLElement;
  submit: HTMLButtonElement;
}

async function handleSubmit(args: SubmitArgs): Promise<void> {
  const { cfg, ctx, memoKey, email, overlay, status, submit } = args;

  // Open mode — no webhook, no verification. Event bus + memo only.
  if (!cfg.webhookUrl || !cfg.challengeUrl) {
    ctx.events.emit("email-gate:submit", { email });
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(memoKey, new Date().toISOString());
    }
    overlay.remove();
    resumePlayback(ctx);
    return;
  }

  // Hardened mode — full proof-of-work flow.
  const challengeRes = await fetch(cfg.challengeUrl, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!challengeRes.ok) {
    submit.disabled = false;
    status.textContent = "Could not reach verification server.";
    return;
  }
  const challenge = (await challengeRes.json()) as LeadsChallenge;
  if (!challenge?.altcha?.challenge || !challenge?.nonce) {
    submit.disabled = false;
    status.textContent = "Verification response was malformed.";
    return;
  }

  status.textContent = "Solving challenge…";
  const { promise } = solveChallenge(
    challenge.altcha.challenge,
    challenge.altcha.salt,
    challenge.altcha.algorithm,
    challenge.altcha.maxnumber,
  );
  const solution = await promise;
  if (!solution) {
    submit.disabled = false;
    status.textContent = "Verification timed out. Please retry.";
    return;
  }

  status.textContent = "Submitting…";
  const submission: LeadsSubmission = {
    email,
    src: ctx.config.src,
    nonce: challenge.nonce,
    altcha: {
      algorithm: challenge.altcha.algorithm,
      challenge: challenge.altcha.challenge,
      salt: challenge.altcha.salt,
      signature: challenge.altcha.signature,
      number: solution.number,
    },
  };

  const submitRes = await fetch(cfg.webhookUrl, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(submission),
  });
  if (!submitRes.ok) {
    submit.disabled = false;
    status.textContent = `Submission rejected (HTTP ${submitRes.status}).`;
    return;
  }

  ctx.events.emit("email-gate:submit", { email });
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(memoKey, new Date().toISOString());
  }
  overlay.remove();
  resumePlayback(ctx);
}

function resumePlayback(ctx: PlayerstackContext): void {
  const player = ctx.mediaPlayer as HTMLElement & { play?: () => Promise<void> | void };
  try {
    const result = player.play?.();
    if (result instanceof Promise) result.catch(() => {});
  } catch {
    /* play() not yet on prototype */
  }
}
