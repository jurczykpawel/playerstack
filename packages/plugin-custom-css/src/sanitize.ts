/**
 * Whitelist check for trusted raw CSS. Returns the trimmed input when it
 * stays inside the allowed subset (declarations + nested selectors + a
 * limited set of at-rules with balanced braces), otherwise `null`. For
 * untrusted theming use the `tokens` API.
 */
export function sanitizeCustomCss(css: string): string | null {
  const trimmed = css.trim();
  if (!trimmed) return null;

  if (trimmed.includes("\\")) return null;

  const lower = trimmed.toLowerCase();
  if (lower.includes("</style")) return null;
  if (/(^|[^a-z])@(import|font-face|namespace|charset)\b/.test(lower)) return null;
  if (lower.includes("expression(")) return null;
  if (lower.includes("javascript:")) return null;
  if (lower.includes("url(")) return null;
  if (lower.includes("image-set(")) return null;

  if (!hasBalancedBraces(trimmed)) return null;

  return trimmed;
}

const TOKEN_NAME_RE = /^--ps-[a-z0-9-]+$/;

/**
 * Validate a single CSS custom-property value for the token API. Values
 * must be a single short literal expression (color, length, keyword, …);
 * multi-declarations, nested blocks, and at-rules are rejected so a token
 * cannot reshape the surrounding ruleset.
 */
export function validateTokenValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length > 256) return false;
  if (/[<>{};\\]/.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (lower.includes("url(")) return false;
  if (lower.includes("image-set(")) return false;
  if (lower.includes("expression(")) return false;
  if (lower.includes("javascript:")) return false;
  if (lower.includes("@")) return false;
  if (lower.includes("</")) return false;
  return true;
}

/**
 * Validate a tokens object. Returns the list of accepted `[name, value]`
 * pairs. Names that don't match `--ps-*` and values that fail
 * `validateTokenValue` are silently dropped (callers can log if desired).
 */
export function validateTokens(
  tokens: Record<string, unknown> | null | undefined,
): Array<[string, string]> {
  if (!tokens || typeof tokens !== "object") return [];
  const out: Array<[string, string]> = [];
  for (const [rawName, rawValue] of Object.entries(tokens)) {
    const name = String(rawName).toLowerCase();
    if (!TOKEN_NAME_RE.test(name)) continue;
    if (typeof rawValue !== "string") continue;
    if (!validateTokenValue(rawValue)) continue;
    out.push([name, rawValue.trim()]);
  }
  return out;
}

/**
 * Balanced-brace check that ignores `{`/`}` inside string literals and
 * `/* ... *​/` comments. Returns `false` when any prefix has more `}` than
 * `{`, or when the total counts diverge.
 */
function hasBalancedBraces(css: string): boolean {
  let depth = 0;
  let inString: '"' | "'" | null = null;
  let inComment = false;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    const next = css[i + 1];

    if (inComment) {
      if (ch === "*" && next === "/") {
        inComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }

    if (ch === "/" && next === "*") {
      inComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
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
