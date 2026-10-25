import {
  activateOverlay,
  isSafeHttpUrl,
  type PlayerstackPlugin,
  type PlayerstackContext,
} from "@playerstack/core";
import { loadHardened } from "./load-hardened";
import { loadOptionalFields } from "./load-optional-fields";
type OptionalFields = typeof import("./optional-fields");
import type { LeadsSubmission } from "./types";

export type { LeadsChallenge, LeadsSubmission } from "./types";

export interface EmailGateConfig {
  enabled?: boolean;
  privacy?: { text: string; linkText?: string; href?: string };
  marketingConsent?: {
    text: string;
    version: string;
    linkText?: string;
    href?: string;
    required?: boolean;
  };
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
  consentRequired: string;
}

type FormMessages = Omit<
  EmailGateMessages,
  "solving" | "submitting" | "rejected" | "rateLimit" | "consentRequired"
>;

const defaultMessages: FormMessages = {
  title: "Watch the rest",
  emailLabel: "Email address",
  placeholder: "you@example.com",
  submit: "Continue watching →",
  verifying: "Verifying…",
  success: "Thank you. Your email was received.",
  invalidEmail: "Please enter a valid email address.",
  networkError: "Could not complete verification. Please retry.",
  dismiss: "Skip",
};

function messagesFor(cfg: EmailGateConfig): FormMessages {
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
  destroyed: boolean;
  shown: boolean;
  submitting: boolean;
  interacted: boolean;
  overlay?: HTMLElement;
  status?: HTMLElement;
  release?: () => void;
  removeTimeListener?: () => void;
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
        "[playerstack] email-gate: `webhookUrl` requires `challengeUrl`. Plugin disabled.",
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
    if (hasMemo(cfg, memoKey)) {
      return;
    }

    const at = cfg.at ?? (cfg.atPercent === undefined ? "before" : undefined);
    const instance: GateState = {
      destroyed: false,
      shown: false,
      submitting: false,
      interacted: false,
      cleanup: () => {
        if (instance.destroyed) return;
        instance.destroyed = true;
        instance.removeTimeListener?.();
        instance.removeTimeListener = undefined;
        ctx.container.removeEventListener("focusin", onInteraction);
        ctx.container.removeEventListener("pointerdown", onInteraction);
        releaseOverlay(instance);
        instance.overlay?.remove();
        instance.status?.remove();
      },
    };
    const onInteraction = () => {
      instance.interacted = true;
    };
    ctx.container.addEventListener("focusin", onInteraction);
    ctx.container.addEventListener("pointerdown", onInteraction);
    states.set(ctx, instance);
    let optional: OptionalFields | undefined;
    if (cfg.privacy || cfg.marketingConsent !== undefined || cfg.product !== undefined) {
      try {
        optional = await loadOptionalFields();
      } catch (error) {
        instance.cleanup();
        throw error;
      }
      if (instance.destroyed) return;
      if (!optional.validConfig(cfg)) {
        instance.cleanup();
        return;
      }
    }

    const show = () => {
      if (instance.shown || instance.destroyed) return;
      instance.shown = true;
      instance.removeTimeListener?.();
      instance.removeTimeListener = undefined;

      const player = ctx.mediaPlayer as HTMLElement & { pause?: () => void };
      player.pause?.();
      if (instance.destroyed) return;
      const overlay = renderOverlay(cfg, ctx, memoKey, instance, optional);
      ctx.container.appendChild(overlay);
      instance.release = activateOverlay(ctx.container, overlay, 4, instance.interacted);
      if (instance.destroyed) releaseOverlay(instance);
    };

    if (at === "before") {
      show();
    } else if (at === "after") {
      ctx.mediaPlayer.addEventListener("ended", show);
      instance.removeTimeListener = () => ctx.mediaPlayer.removeEventListener("ended", show);
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
      instance.removeTimeListener = () => ctx.mediaPlayer.removeEventListener("timeupdate", onTime);
    }
  },
  destroy(ctx: PlayerstackContext): void {
    const instance = states.get(ctx);
    if (!instance) return;
    if (states.get(ctx) === instance) states.delete(ctx);
    instance.cleanup();
  },
};

function releaseOverlay(instance: GateState): void {
  const release = instance.release;
  instance.release = undefined;
  release?.();
}

function renderOverlay(
  cfg: EmailGateConfig,
  ctx: PlayerstackContext,
  memoKey: string,
  instance: GateState,
  optional?: OptionalFields,
): HTMLElement {
  const isActive = () => !instance.destroyed;
  const release = () => releaseOverlay(instance);
  const messages = messagesFor(cfg);
  const overlay = document.createElement("div");
  instance.overlay = overlay;
  overlay.className = "playerstack-email-gate";
  overlay.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;" +
    "overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;box-sizing:border-box;" +
    "background:rgba(0,0,0,0.85);color:#fff;padding:24px;z-index:4;";

  const form = document.createElement("form");
  form.noValidate = true;
  form.style.cssText =
    "display:grid;gap:12px;max-width:420px;width:100%;text-align:center;margin:auto;flex-shrink:0;";

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

  const consentInput = optional?.renderFields(cfg, form, input, isActive);

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
  instance.status = status;
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

  async function handleSubmit(email: string, consent: ConsentFields): Promise<void> {
    const active = () => !instance.destroyed && overlay.isConnected;
    const success = () => {
      if (!active()) return;
      saveMemo(cfg, memoKey);
      if (!active()) return;
      ctx.events.emit("email-gate:submit", {
        email,
        ...consent,
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
    const fail = () => {
      if (!active()) return;
      instance.submitting = false;
      submit.disabled = false;
    };

    if (!cfg.webhookUrl || !cfg.challengeUrl) {
      success();
      return;
    }

    const challengeUrl = new URL(cfg.challengeUrl);
    if (cfg.product !== undefined) challengeUrl.searchParams.set("product", cfg.product);
    const response = fetch(challengeUrl.href, {
      credentials: "include",
      headers: { Accept: "application/json" },
    }).then(
      (value) => ({ value }),
      () => ({}),
    );
    const { submitChallenge } = await loadHardened();
    if (!active()) return;
    await submitChallenge({
      cfg,
      src: ctx.config.src,
      email,
      consent,
      response,
      active,
      success,
      fail,
      setStatus: (message) => {
        status.textContent = message;
      },
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isActive() || !overlay.isConnected || instance.submitting || submit.disabled) return;
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

    const consent =
      optional?.readConsent(cfg, consentInput, status) ?? (cfg.marketingConsent ? undefined : {});
    if (!consent) return;

    instance.submitting = true;
    if (overlay.ownerDocument.activeElement === submit) {
      input.focus();
      if (!isActive() || !overlay.isConnected) return;
    }
    submit.disabled = true;
    status.textContent = messages.verifying;

    void handleSubmit(email, consent).catch(() => {
      if (!isActive() || !overlay.isConnected) return;
      instance.submitting = false;
      submit.disabled = false;
      status.textContent = messages.networkError;
    });
  });

  overlay.appendChild(form);
  return overlay;
}

type ConsentFields = Pick<LeadsSubmission, "marketingConsent" | "consentVersion" | "consentText">;

function resumePlayback(ctx: PlayerstackContext): void {
  const player = ctx.mediaPlayer as HTMLElement & { play?: () => Promise<void> | void };
  try {
    const result = player.play?.();
    if (result instanceof Promise) result.catch(() => {});
  } catch {
    /* play() not yet on prototype */
  }
}
