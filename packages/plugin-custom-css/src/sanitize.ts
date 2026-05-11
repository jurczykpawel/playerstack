/**
 * Reject CSS that contains constructs we cannot allow safely:
 * - `</style>` (ends the injected <style> block early — XSS escape)
 * - `@import` (loads remote stylesheets — exfiltration / supply chain)
 * - `expression(` (legacy IE; harmless today but signals tampering intent)
 * - `javascript:` URLs in `url(...)` (XSS in legacy contexts)
 *
 * For valid input, returns the trimmed CSS. For unsafe or empty input, returns null.
 */
export function sanitizeCustomCss(css: string): string | null {
  const trimmed = css.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower.includes("</style")) return null;
  if (/(^|[^a-z])@import\b/.test(lower)) return null;
  if (lower.includes("expression(")) return null;
  if (lower.includes("javascript:")) return null;

  return trimmed;
}

/**
 * Wrap user CSS in a scope selector using native CSS Nesting (baseline 2023).
 * Inside the wrapper the user can write:
 *   - bare property declarations (style the player root itself)
 *   - `& selector` rules (style descendants)
 *   - at-rules like `@media`, `@supports`, `@keyframes`
 */
export function scopeCustomCss(css: string, scope: string): string {
  return `${scope} {\n${css}\n}`;
}
