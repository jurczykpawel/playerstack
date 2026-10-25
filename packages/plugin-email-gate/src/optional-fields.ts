import type { EmailGateConfig } from "./index";
import type { LeadsSubmission } from "./types";
type ConsentFields = Pick<LeadsSubmission, "marketingConsent" | "consentVersion" | "consentText">;
export function validConfig(cfg: EmailGateConfig): boolean {
  if (
    cfg.product !== undefined &&
    (typeof cfg.product !== "string" || !cfg.product.trim() || cfg.product.length > 100)
  ) {
    console.warn(
      "[playerstack] email-gate: product must contain 1–100 characters. Plugin disabled.",
    );
    return false;
  }

  const consent = cfg.marketingConsent;
  if (
    consent !== undefined &&
    (!consent ||
      typeof consent.text !== "string" ||
      !consent.text.trim() ||
      consent.text.length > 500 ||
      typeof consent.version !== "string" ||
      !consent.version.trim() ||
      consent.version.length > 64)
  ) {
    console.warn(
      "[playerstack] email-gate: marketingConsent requires text (1–500 characters) and version (1–64). Plugin disabled.",
    );
    return false;
  }

  return true;
}
export function renderFields(
  cfg: EmailGateConfig,
  form: HTMLFormElement,
  input: HTMLInputElement,
  isActive: () => boolean,
): HTMLInputElement | undefined {
  if (cfg.privacy) {
    const privacy = document.createElement("p");
    privacy.id = `playerstack-email-privacy-${crypto.getRandomValues(new Uint32Array(2)).join("-")}`;
    privacy.textContent = cfg.privacy.text;
    appendConfiguredLink(privacy, cfg.privacy);
    input.setAttribute("aria-describedby", privacy.id);
    form.append(privacy);
  }

  const consentInput = cfg.marketingConsent ? document.createElement("input") : undefined;
  if (consentInput && cfg.marketingConsent) {
    const row = document.createElement("div");
    row.style.cssText = "font-size:13px;text-align:left;";
    const label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:flex-start;gap:8px;cursor:pointer;";
    consentInput.type = "checkbox";
    consentInput.name = "marketingConsent";
    consentInput.required = cfg.marketingConsent.required === true;
    consentInput.style.cssText = "flex-shrink:0;margin:3px 0 0;";
    const text = document.createElement("span");
    text.textContent = cfg.marketingConsent.text;
    label.append(consentInput, text);
    row.append(label);
    appendConfiguredLink(row, cfg.marketingConsent);
    form.append(row);
    consentInput.addEventListener("change", () => {
      if (isActive() && consentInput.checked) consentInput.removeAttribute("aria-invalid");
    });
  }

  return consentInput;
}
export function readConsent(
  cfg: EmailGateConfig,
  consentInput: HTMLInputElement | undefined,
  status: HTMLElement,
): ConsentFields | undefined {
  if (consentInput?.required && !consentInput.checked) {
    status.textContent = cfg.messages?.consentRequired ?? "Please select the consent checkbox.";
    consentInput.setAttribute("aria-invalid", "true");
    consentInput.focus();
    return undefined;
  }
  const consent: ConsentFields = !cfg.marketingConsent
    ? {}
    : consentInput?.checked
      ? {
          marketingConsent: true,
          consentVersion: cfg.marketingConsent.version,
          consentText: cfg.marketingConsent.text,
        }
      : { marketingConsent: false };

  return consent;
}
function appendConfiguredLink(
  parent: HTMLElement,
  config: { href?: string; linkText?: string },
): void {
  const { href, linkText } = config;
  if (!href || !linkText) return;
  try {
    if (!["http:", "https:"].includes(new URL(href, document.baseURI).protocol)) return;
  } catch {
    return;
  }
  const link = document.createElement("a");
  link.href = href;
  link.textContent = linkText;
  link.rel = "noopener noreferrer";
  parent.append(" ", link);
}
