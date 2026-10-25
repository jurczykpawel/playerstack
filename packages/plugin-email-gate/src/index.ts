import {
  activateOverlay,
  isSafeHttpUrl,
  type PlayerstackPlugin,
  type PlayerstackContext,
} from "@playerstack/core";
import { solveChallenge } from "altcha-lib";
import type { LeadsChallenge, LeadsSubmission } from "./types";

export type { LeadsChallenge, LeadsSubmission } from "./types";

export interface EmailGateConfig {
  enabled?: boolean;
  privacy?: { text: string; linkText?: string; href?: string };
  product?: string;
  dismissible?: boolean;
  messages?: Partial<EmailGateMessages>;
  remember?: boolean;
  rememberDays?: number;
  altchaFormat?: "object" | "base64";
  /** "before" shows on init, "after" on ended. Numbers are seconds; use `atPercent` for percentages. */
  at?: "before" | "after" | number;
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

export interface EmailGateMessages {
  title: string;
  emailLabel: string;
  placeholder: string;
  submit: string;
  verifying: string;
  solving: string;
  submitting: string;
  success: string;
  invalidEmail: string;
  rejected: string;
  rateLimit: string;
  networkError: string;
  dismiss: string;
}

const defaultMessages: EmailGateMessages = {
  title: "Watch the rest",
  emailLabel: "Email address",
  placeholder: "you@example.com",
  submit: "Continue watching →",
  verifying: "Verifying…",
  solving: "Solving challenge…",
  submitting: "Submitting…",
  success: "Thank you. Your email was received.",
  invalidEmail: "Please enter a valid email address.",
  rejected: "Submission rejected. Please retry.",
  rateLimit: "Too many requests. Please try again later.",
  networkError: "Could not complete verification. Please retry.",
  dismiss: "Skip",
};

function messagesFor(cfg: EmailGateConfig): EmailGateMessages {
  return {
    ...defaultMessages,
    title: cfg.title ?? defaultMessages.title,
    submit: cfg.buttonLabel ?? defaultMessages.submit,
    ...cfg.messages,
  };
}

function hasMemo(cfg: EmailGateConfig, key: string): boolean {
  if (cfg.remember === false) return false;
  try {
    const memo = localStorage.getItem(key);
    if (!memo) return false;
    if (cfg.rememberDays !== undefined) {
      const timestamp = Date.parse(memo);
      if (!Number.isFinite(timestamp) || Date.now() >= timestamp + cfg.rememberDays * 86400000) {
        localStorage.removeItem(key);
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function saveMemo(cfg: EmailGateConfig, key: string): void {
  if (cfg.remember === false) return;
  try {
    localStorage.setItem(key, new Date().toISOString());
  } catch {
    /* Storage is optional. */
  }
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

    if (
      cfg.product !== undefined &&
      (typeof cfg.product !== "string" || !cfg.product.trim() || cfg.product.length > 100)
    ) {
      console.warn(
        "[playerstack] email-gate: product must contain 1–100 characters. Plugin disabled.",
      );
      return;
    }

    const memoKey = `${cfg.storageKey ?? "playerstack:email-gate"}:${ctx.config.src}`;
    if (hasMemo(cfg, memoKey)) {
      return;
    }

    const at = cfg.at ?? (cfg.atPercent === undefined ? "before" : undefined);
    let shown = false;
    let destroyed = false;
    const isActive = () => !destroyed;
    let release: (() => void) | undefined;
    let interacted = false;
    const onInteraction = () => {
      interacted = true;
    };
    ctx.container.addEventListener("focusin", onInteraction);
    ctx.container.addEventListener("pointerdown", onInteraction);
    const releaseOverlay = () => {
      const currentRelease = release;
      release = undefined;
      currentRelease?.();
    };
    let removeTimeListener: (() => void) | null = null;

    const show = () => {
      if (shown || destroyed) return;
      shown = true;
      removeTimeListener?.();
      removeTimeListener = null;

      const player = ctx.mediaPlayer as HTMLElement & { pause?: () => void };
      player.pause?.();
      if (!isActive()) return;
      const overlay = renderOverlay(cfg, ctx, memoKey, releaseOverlay, isActive);
      ctx.container.appendChild(overlay);
      release = activateOverlay(ctx.container, overlay, 4, interacted);
      if (!isActive()) releaseOverlay();
    };

    states.set(ctx, {
      cleanup: () => {
        destroyed = true;
        removeTimeListener?.();
        ctx.container.removeEventListener("focusin", onInteraction);
        ctx.container.removeEventListener("pointerdown", onInteraction);
        releaseOverlay();
        ctx.container.querySelector(".playerstack-email-gate")?.remove();
        ctx.container.querySelector(".playerstack-email-gate-status")?.remove();
      },
    });

    if (at === "before") {
      show();
    } else if (at === "after") {
      ctx.mediaPlayer.addEventListener("ended", show);
      removeTimeListener = () => ctx.mediaPlayer.removeEventListener("ended", show);
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
  release: () => void,
  isActive: () => boolean,
): HTMLElement {
  const messages = messagesFor(cfg);
  const overlay = document.createElement("div");
  overlay.className = "playerstack-email-gate";
  overlay.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(0,0,0,0.85);color:#fff;padding:24px;z-index:4;";

  const form = document.createElement("form");
  form.noValidate = true;
  form.style.cssText = "display:grid;gap:12px;max-width:420px;width:100%;text-align:center;";

  const heading = document.createElement("h3");
  heading.textContent = messages.title;
  heading.style.cssText = "margin:0;font-size:22px;font-weight:600;";
  form.appendChild(heading);

  const input = document.createElement("input");
  input.type = "email";
  input.name = "email";
  input.required = true;
  input.placeholder = messages.placeholder;
  input.setAttribute("aria-label", messages.emailLabel);
  input.autocomplete = "email";
  input.style.cssText =
    "padding:10px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);" +
    "background:rgba(255,255,255,0.05);color:#fff;font-size:15px;";
  form.appendChild(input);

  if (cfg.privacy) {
    const privacy = document.createElement("p");
    privacy.id = `playerstack-email-privacy-${crypto.getRandomValues(new Uint32Array(2)).join("-")}`;
    privacy.textContent = cfg.privacy.text;
    const { href, linkText } = cfg.privacy;
    let safe = false;
    if (href) {
      try {
        safe = ["http:", "https:"].includes(new URL(href, document.baseURI).protocol);
      } catch {
        /* Omit invalid links. */
      }
    }
    if (safe && href && linkText) {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = linkText;
      link.rel = "noopener noreferrer";
      privacy.append(" ", link);
    }
    input.setAttribute("aria-describedby", privacy.id);
    form.append(privacy);
  }

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
  submit.textContent = messages.submit;
  submit.style.cssText =
    "padding:10px 16px;border-radius:6px;border:none;background:var(--ps-accent,#008aff);" +
    "color:#fff;font-weight:600;cursor:pointer;";
  form.appendChild(submit);

  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.className = "playerstack-email-gate-status";
  status.style.cssText = "margin:0;font-size:13px;min-height:1.2em;opacity:0.85;";
  form.appendChild(status);

  const dismissible = cfg.dismissible ?? cfg.at === "after";
  if (dismissible) {
    const dismiss = () => {
      if (!isActive() || !overlay.isConnected) return;
      release();
      if (!isActive()) return;
      overlay.remove();
      ctx.events.emit("email-gate:dismiss", {});
      if (isActive() && cfg.at !== "after") resumePlayback(ctx);
    };
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = messages.dismiss;
    button.addEventListener("click", dismiss);
    form.append(button);
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isActive() || !overlay.isConnected || submit.disabled) return;
    if (honey.value) {
      // Bot tripped the honeypot. Pretend success silently — no signal back.
      release();
      if (!isActive()) return;
      overlay.remove();
      return;
    }
    const email = input.value.trim();
    if (!email || !input.checkValidity()) {
      status.textContent = messages.invalidEmail;
      return;
    }

    submit.disabled = true;
    status.textContent = messages.verifying;

    void handleSubmit({
      cfg,
      ctx,
      memoKey,
      email,
      overlay,
      status,
      submit,
      release,
      isActive,
    }).catch(() => {
      if (!isActive() || !overlay.isConnected) return;
      submit.disabled = false;
      status.textContent = messages.networkError;
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
  release: () => void;
  isActive: () => boolean;
}

async function handleSubmit(args: SubmitArgs): Promise<void> {
  const { cfg, ctx, memoKey, email, overlay, status, submit, release, isActive } = args;

  const messages = messagesFor(cfg);
  const active = () => isActive() && overlay.isConnected;
  const success = () => {
    if (!active()) return;
    saveMemo(cfg, memoKey);
    if (!active()) return;
    ctx.events.emit("email-gate:submit", {
      email,
      ...(cfg.product === undefined ? {} : { product: cfg.product }),
    });
    if (!active()) return;
    status.textContent = messages.success;
    release();
    if (!active()) return;
    ctx.container.append(status);
    overlay.remove();
    if (cfg.at !== "after") resumePlayback(ctx);
  };
  const fail = (code?: number) => {
    if (!active()) return;
    submit.disabled = false;
    status.textContent =
      code === 429
        ? messages.rateLimit
        : code !== undefined && code >= 400 && code < 500
          ? messages.rejected
          : messages.networkError;
  };

  if (!cfg.webhookUrl || !cfg.challengeUrl) {
    success();
    return;
  }

  const challengeUrl = new URL(cfg.challengeUrl);
  if (cfg.product !== undefined) challengeUrl.searchParams.set("product", cfg.product);
  const challengeRes = await fetch(challengeUrl.href, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!active()) return;
  if (!challengeRes.ok) {
    fail(challengeRes.status);
    return;
  }
  const challenge: unknown = await challengeRes.json();
  if (!active()) return;
  if (!isChallenge(challenge)) {
    fail();
    return;
  }
  status.textContent = messages.solving;
  const { promise } = solveChallenge(
    challenge.altcha.challenge,
    challenge.altcha.salt,
    challenge.altcha.algorithm,
    challenge.altcha.maxnumber,
  );
  const solution = await promise;
  if (!active()) return;
  if (!solution) {
    fail();
    return;
  }

  status.textContent = messages.submitting;
  const payload = {
    algorithm: challenge.altcha.algorithm,
    challenge: challenge.altcha.challenge,
    salt: challenge.altcha.salt,
    signature: challenge.altcha.signature,
    number: solution.number,
  };
  const submission: LeadsSubmission = {
    email,
    src: ctx.config.src,
    ...(cfg.product === undefined ? {} : { product: cfg.product }),
    nonce: challenge.nonce,
    altcha: cfg.altchaFormat === "base64" ? encodePayload(payload) : payload,
  };
  const submitRes = await fetch(cfg.webhookUrl, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(submission),
  });
  if (!submitRes.ok) {
    fail(submitRes.status);
    return;
  }
  success();
}

function isChallenge(value: unknown): value is LeadsChallenge {
  if (!value || typeof value !== "object") return false;
  const { altcha, nonce } = value as Partial<LeadsChallenge>;
  return (
    typeof nonce === "string" &&
    nonce.trim().length > 0 &&
    !!altcha &&
    ["SHA-1", "SHA-256", "SHA-512"].includes(altcha.algorithm) &&
    [altcha.challenge, altcha.salt, altcha.signature].every(
      (field) => typeof field === "string" && field.length > 0,
    ) &&
    (altcha.maxnumber === undefined ||
      (Number.isSafeInteger(altcha.maxnumber) && altcha.maxnumber >= 0))
  );
}

function encodePayload(payload: Exclude<LeadsSubmission["altcha"], string>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
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
