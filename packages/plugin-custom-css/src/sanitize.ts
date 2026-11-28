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

  if (!staysInScope(trimmed)) return null;

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

const ALLOWED_AT_RULE = /^@(media|supports|container|layer|keyframes|-webkit-keyframes)(?![\w-])/i;

/**
 * Check that the CSS stays inside the scope wrapper: braces balance, strings
 * and comments close (a CSS string also ends at a newline, which would let a
 * later `}` close the wrapper), and every rule prelude is an allowed at-rule
 * or a selector that cannot reach outside the player.
 */
function staysInScope(css: string): boolean {
  let depth = 0;
  let inString: '"' | "'" | null = null;
  let inComment = false;
  // ( and [ blocks: CSS keeps ; { } inside them as content, not as rule syntax.
  let brackets = 0;
  let prelude = "";
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
      if (ch === "\n" || ch === "\r" || ch === "\f") return false;
      // The prelude keeps only the quotes: a string is one token in CSS, so
      // brackets or & inside it must not count as selector structure.
      if (ch === inString) {
        inString = null;
        prelude += ch;
      }
      continue;
    }

    if (ch === "/" && next === "*") {
      inComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") inString = ch;
    if (ch === "(" || ch === "[") brackets++;
    else if ((ch === ")" || ch === "]") && --brackets < 0) return false;
    else if (brackets > 0 && (ch === "{" || ch === "}" || ch === ";")) return false;

    if (ch === "{") {
      if (!isSafePrelude(prelude)) return false;
      depth++;
      prelude = "";
    } else if (ch === "}" || ch === ";") {
      if (ch === "}" && --depth < 0) return false;
      prelude = "";
    } else {
      prelude += ch;
    }
  }
  return depth === 0 && brackets === 0 && !inString && !inComment;
}

/**
 * Inside the wrapper `&` is the player. A selector reaches outside it when
 * `&` sits inside a pseudo-class like `:not(&)`, or when a compound that
 * contains `&` is followed by a sibling combinator (`& ~ p`, `&:hover + p`,
 * or a bare `~ p`, which nesting reads as `& ~ p`).
 */
function isSafePrelude(prelude: string): boolean {
  const text = prelude.trim();
  if (text.startsWith("@")) return ALLOWED_AT_RULE.test(text);
  let parens = 0;
  for (const ch of text) {
    if (ch === "(") parens++;
    else if (ch === ")") parens--;
    else if (ch === "&" && parens > 0) return false;
  }
  let flat = text;
  // A group becomes one placeholder character, so it still separates `&` from `~`.
  while (/\([^()]*\)|\[[^[\]]*\]/.test(flat)) flat = flat.replace(/\([^()]*\)|\[[^[\]]*\]/g, "_");
  return !flat.split(",").some((selector) => /^\s*[~+]|&[^\s>~+]*\s*[~+]/.test(selector));
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
