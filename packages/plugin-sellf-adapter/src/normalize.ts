import type { PlayerstackConfig } from "@playerstack/core";

/**
 * Normalize a remote Sellf config response onto the documented allowlist.
 * Unknown top-level keys are dropped. Sub-keys that the adapter contract does
 * NOT expose (raw HTML, trusted CSS, fetch endpoints) are stripped even if the
 * surrounding object is allowed. Returns a fresh object; never mutates the
 * input.
 *
 * The contract: Sellf API may control which player to render and how it looks
 * via tokens + typed config. It must NOT supply executable strings, raw HTML
 * blobs, or fetch endpoints — those are the integrator's responsibility, set
 * via `SellfAdapterOptions.endpoints` and inline developer-authored config.
 */
export function normalizeRemoteConfig(input: unknown): Partial<PlayerstackConfig> {
  if (!isObject(input)) return {};
  const out: Record<string, unknown> = {};

  // Plain string / scalar top-level fields.
  pickString(input, "src", out);
  pickString(input, "poster", out);
  pickString(input, "title", out);
  pickEnum(input, "crossorigin", ["anonymous", "use-credentials"], out);

  // Typed plugin configs — each goes through a per-section normalizer.
  if (isObject(input.controls)) out.controls = normalizeControls(input.controls);
  if (isObject(input.actionBar)) out.actionBar = normalizeActionBar(input.actionBar);
  if (isObject(input.ctaEnd)) out.ctaEnd = normalizeCtaEnd(input.ctaEnd);
  if (isObject(input.introCard)) out.introCard = normalizeIntroCard(input.introCard);
  if (isObject(input.brandedThumb)) out.brandedThumb = normalizeBrandedThumb(input.brandedThumb);
  if (isObject(input.customCss)) out.customCss = normalizeCustomCss(input.customCss);
  if (isObject(input.watermark)) out.watermark = normalizeWatermark(input.watermark);
  if (isObject(input.analytics)) out.analytics = normalizeAnalytics(input.analytics);
  if (isObject(input.emailGate)) out.emailGate = normalizeEmailGate(input.emailGate);
  if (isObject(input.preview)) out.preview = normalizePreview(input.preview);
  if (isObject(input.autopreview)) out.autopreview = normalizeAutopreview(input.autopreview);
  if (isObject(input.savedPosition))
    out.savedPosition = normalizeSavedPosition(input.savedPosition);
  if (isObject(input.focusMode)) out.focusMode = normalizeFocusMode(input.focusMode);
  if (isObject(input.sticky)) out.sticky = normalizeSticky(input.sticky);
  if (isObject(input.chapters)) out.chapters = normalizeChapters(input.chapters);
  if (isObject(input.ytSubscribe)) out.ytSubscribe = normalizeYtSubscribe(input.ytSubscribe);
  if (isObject(input.twitch)) out.twitch = normalizeTwitch(input.twitch);

  return out as Partial<PlayerstackConfig>;
}

// -- top-level helpers --------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function pickString(src: Record<string, unknown>, key: string, out: Record<string, unknown>): void {
  if (typeof src[key] === "string") out[key] = src[key];
}

function pickBool(src: Record<string, unknown>, key: string, out: Record<string, unknown>): void {
  if (typeof src[key] === "boolean") out[key] = src[key];
}

function pickNumber(src: Record<string, unknown>, key: string, out: Record<string, unknown>): void {
  if (typeof src[key] === "number" && Number.isFinite(src[key])) out[key] = src[key];
}

function pickEnum(
  src: Record<string, unknown>,
  key: string,
  allowed: readonly string[],
  out: Record<string, unknown>,
): void {
  const v = src[key];
  if (typeof v === "string" && allowed.includes(v)) out[key] = v;
}

function pickStringArray(
  src: Record<string, unknown>,
  key: string,
  out: Record<string, unknown>,
): void {
  const v = src[key];
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[key] = v;
}

// -- per-section normalizers --------------------------------------------------

function normalizeControls(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickString(c, "accent", out);
  pickStringArray(c, "show", out);
  pickStringArray(c, "hide", out);
  return out;
}

function normalizeActionBar(c: Record<string, unknown>): Record<string, unknown> {
  // `html` deliberately omitted — raw HTML must come from the integrator's
  // own code, not the Sellf API response.
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickString(c, "title", out);
  pickEnum(c, "position", ["top", "bottom"], out);
  pickNumber(c, "atPercent", out);
  const showAt = c.showAt;
  if (showAt === "start" || (typeof showAt === "number" && Number.isFinite(showAt))) {
    out.showAt = showAt;
  }
  if (isObject(c.button)) out.button = normalizeCta(c.button);
  return out;
}

function normalizeCtaEnd(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickString(c, "title", out);
  pickBool(c, "showReplay", out);
  if (isObject(c.button)) out.button = normalizeCta(c.button);
  return out;
}

function normalizeIntroCard(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickString(c, "badge", out);
  pickString(c, "title", out);
  pickString(c, "subtitle", out);
  pickString(c, "image", out);
  pickEnum(c, "position", ["fullscreen", "bottom", "center"], out);
  pickEnum(c, "theme", ["dark", "light", "transparent"], out);
  pickBool(c, "dismissible", out);
  if (isObject(c.cta)) out.cta = normalizeCta(c.cta);
  return out;
}

function normalizeCta(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickString(c, "label", out);
  pickString(c, "url", out);
  pickString(c, "utm", out);
  return out;
}

function normalizeBrandedThumb(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickEnum(c, "playButtonStyle", ["minimal", "box", "circle"], out);
  pickBool(c, "clickToLoad", out);
  pickBool(c, "transparent", out);
  pickBool(c, "unmuteOnPlay", out);
  pickBool(c, "restartOnPlay", out);
  return out;
}

function normalizeCustomCss(c: Record<string, unknown>): Record<string, unknown> {
  // `trustedCss`, `css`, and `acknowledgeTrusted` deliberately omitted —
  // raw CSS must come from the integrator's own code path.
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  if (isObject(c.tokens)) {
    const tokens: Record<string, string> = {};
    for (const [k, v] of Object.entries(c.tokens)) {
      if (typeof v === "string") tokens[k] = v;
    }
    out.tokens = tokens;
  }
  return out;
}

function normalizeWatermark(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickString(c, "src", out);
  pickString(c, "text", out);
  pickString(c, "href", out);
  pickEnum(c, "position", ["top-left", "top-right", "bottom-left", "bottom-right"], out);
  pickNumber(c, "opacity", out);
  pickNumber(c, "margin", out);
  pickNumber(c, "width", out);
  return out;
}

function normalizeAnalytics(c: Record<string, unknown>): Record<string, unknown> {
  // `endpoint` deliberately omitted — must come from
  // `SellfAdapterOptions.endpoints.analytics`. `provider` is also kept under
  // the integrator's control to avoid surprise gtag/console swaps.
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickBool(c, "debug", out);
  pickStringArray(c, "forwardBusEvents", out);
  pickStringArray(c, "forwardMediaEvents", out);
  if (typeof c.quartiles === "boolean") {
    out.quartiles = c.quartiles;
  } else if (Array.isArray(c.quartiles)) {
    const nums = c.quartiles.filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 100,
    );
    if (nums.length > 0) out.quartiles = nums;
  }
  if (isObject(c.customProps)) {
    // Allow scalar-only custom props (strings, numbers, booleans). Nested
    // objects / arrays are dropped so adapter callers can't smuggle complex
    // payloads through this surface.
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(c.customProps)) {
      const t = typeof v;
      if (t === "string" || t === "number" || t === "boolean") props[k] = v;
    }
    out.customProps = props;
  }
  return out;
}

function normalizeEmailGate(c: Record<string, unknown>): Record<string, unknown> {
  // `webhookUrl` and `challengeUrl` deliberately omitted — must come from
  // `SellfAdapterOptions.endpoints.emailGate`.
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickString(c, "title", out);
  pickString(c, "buttonLabel", out);
  pickString(c, "storageKey", out);
  pickNumber(c, "atPercent", out);
  const at = c.at;
  if (at === "before" || (typeof at === "number" && Number.isFinite(at))) {
    out.at = at;
  }
  return out;
}

function normalizePreview(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickBool(c, "loopUntilInteraction", out);
  return out;
}

function normalizeAutopreview(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickNumber(c, "threshold", out);
  return out;
}

function normalizeSavedPosition(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickString(c, "storageKey", out);
  return out;
}

function normalizeFocusMode(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  return out;
}

function normalizeSticky(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickEnum(c, "position", ["top-left", "top-right", "bottom-left", "bottom-right"], out);
  return out;
}

function normalizeChapters(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (Array.isArray(c.points)) {
    const points = c.points
      .filter(isObject)
      .map((p) => {
        const r: Record<string, unknown> = {};
        pickNumber(p, "time", r);
        pickString(p, "label", r);
        return r;
      })
      .filter((p) => typeof p.time === "number" && typeof p.label === "string");
    out.points = points;
  }
  return out;
}

function normalizeYtSubscribe(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  pickBool(c, "enabled", out);
  pickString(c, "channel", out);
  pickString(c, "label", out);
  return out;
}

function normalizeTwitch(c: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof c.parent === "string") {
    out.parent = c.parent;
  } else if (Array.isArray(c.parent) && c.parent.every((x) => typeof x === "string")) {
    out.parent = c.parent;
  }
  return out;
}
