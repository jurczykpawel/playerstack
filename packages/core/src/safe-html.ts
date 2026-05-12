/**
 * Whitelist HTML sanitizer + URL helpers used by plugins that render
 * config-driven strings (HTML snippets, CTA URLs). Config values may come
 * from a shortcode, a CMS field, or an API response, so plugins route them
 * through the helpers below before writing into the DOM.
 */

const ALLOWED_TAGS = new Set([
  "A",
  "B",
  "BR",
  "CODE",
  "EM",
  "H3",
  "H4",
  "H5",
  "H6",
  "I",
  "LI",
  "OL",
  "P",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "U",
  "UL",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(["href"]),
};

/**
 * Tags whose entire subtree (including text content) is dropped. For
 * disallowed tags that aren't on this list we keep the text — useful for
 * accidental `<div>` wrappers around legit marketing copy.
 */
const DROP_SUBTREE = new Set(["SCRIPT", "STYLE", "IFRAME", "NOSCRIPT", "OBJECT", "EMBED"]);

function isAttrAllowedForTag(tag: string, name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith("on")) return false;
  if (lower === "style" || lower === "id") return false;
  if (lower === "class") return true;
  if (lower.startsWith("data-") || lower.startsWith("aria-")) return true;
  if (lower === "role") return true;
  const tagSpecific = ALLOWED_ATTRS[tag];
  return tagSpecific ? tagSpecific.has(lower) : false;
}

/** Return true for absolute URLs whose protocol is `http:` or `https:`. */
export function isSafeHttpUrl(url: string | undefined | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Render an HTML fragment through a tag + attribute whitelist. Anchors get
 * `rel="noopener noreferrer"` and `target="_blank"` applied. Returns the
 * resulting HTML string (may be empty).
 */
export function sanitizeHtml(input: string | undefined | null): string {
  if (!input) return "";
  if (typeof document === "undefined") return "";
  const template = document.createElement("template");
  template.innerHTML = String(input);
  sanitizeNode(template.content);
  return template.innerHTML;
}

function sanitizeNode(node: Node): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.parentNode?.removeChild(child);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as Element;
    const tag = el.tagName.toUpperCase();

    if (!ALLOWED_TAGS.has(tag)) {
      if (DROP_SUBTREE.has(tag)) {
        el.parentNode?.removeChild(el);
      } else {
        const text = el.ownerDocument!.createTextNode(el.textContent ?? "");
        el.parentNode?.replaceChild(text, el);
      }
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!isAttrAllowedForTag(tag, name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (tag === "A" && name === "href" && !isSafeHttpUrl(attr.value)) {
        el.removeAttribute("href");
      }
    }

    if (tag === "A" && el.hasAttribute("href")) {
      el.setAttribute("rel", "noopener noreferrer");
      el.setAttribute("target", "_blank");
    }

    sanitizeNode(el);
  }
}

/**
 * Build a CTA URL by appending an optional UTM query suffix. Returns `null`
 * if `base` is not an `http(s)` URL, or if appending UTM yields a string
 * that no longer parses as `http(s)`.
 */
export function buildSafeCtaUrl(base: string | undefined | null, utm?: string): string | null {
  if (!isSafeHttpUrl(base)) return null;
  if (!utm) return base;
  const sep = base.includes("?") ? "&" : "?";
  const composed = `${base}${sep}${utm}`;
  return isSafeHttpUrl(composed) ? composed : null;
}
