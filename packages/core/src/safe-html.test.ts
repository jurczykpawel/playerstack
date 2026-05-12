import { describe, expect, it } from "vitest";
import { buildSafeCtaUrl, isSafeHttpUrl, sanitizeHtml } from "./safe-html";

describe("isSafeHttpUrl", () => {
  it("returns true for http and https URLs", () => {
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("https://example.com/path?q=1#h")).toBe(true);
  });

  it("returns false for non-http(s) protocols", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("JAVASCRIPT:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,<x>")).toBe(false);
    expect(isSafeHttpUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
  });

  it("returns false for empty / undefined / unparseable input", () => {
    expect(isSafeHttpUrl(undefined)).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
    expect(isSafeHttpUrl("not a url")).toBe(false);
    expect(isSafeHttpUrl("/relative/path")).toBe(false);
  });
});

describe("sanitizeHtml", () => {
  it("returns empty string for empty / undefined input", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
    expect(sanitizeHtml(null)).toBe("");
  });

  it("removes <script> elements including their content", () => {
    const out = sanitizeHtml('hello <script>alert("x")</script> world');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
  });

  it("removes event-handler attributes from disallowed tags", () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert");
  });

  it("removes <iframe>", () => {
    expect(sanitizeHtml('<iframe src="https://example.com"></iframe>')).not.toContain("iframe");
  });

  it("keeps whitelisted tags (p, em, strong, br, h3)", () => {
    const html = "<p>foo <em>bar</em> <strong>baz</strong></p><h3>title</h3><br>";
    const out = sanitizeHtml(html);
    expect(out).toContain("<p>");
    expect(out).toContain("<em>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<h3>");
  });

  it("keeps class, data-*, aria-* attributes", () => {
    const out = sanitizeHtml('<p class="hi" data-id="x" aria-label="lbl">x</p>');
    expect(out).toContain('class="hi"');
    expect(out).toContain('data-id="x"');
    expect(out).toContain('aria-label="lbl"');
  });

  it("removes style, id, and event-handler attributes from whitelisted tags", () => {
    const out = sanitizeHtml('<p style="background:red" id="dangerous" onclick="alert(1)">x</p>');
    expect(out).not.toContain("style");
    expect(out).not.toContain("id=");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("alert");
  });

  it("drops non-http(s) href on <a>, keeps the anchor text", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain("javascript");
    expect(out).not.toContain("alert");
    expect(out).toContain("click");
  });

  it("forces rel=noopener+noreferrer target=_blank on safe anchors", () => {
    const out = sanitizeHtml('<a href="https://example.com">go</a>');
    expect(out).toContain('href="https://example.com');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it("removes HTML comments", () => {
    expect(sanitizeHtml("hello <!-- note --> world")).not.toContain("<!--");
  });

  it("inlines the text content of unknown tags", () => {
    expect(sanitizeHtml("<div>hello</div>")).toContain("hello");
    expect(sanitizeHtml("<svg>oops</svg>")).toContain("oops");
  });

  it("removes event-handler attributes from unknown tags (inlined as text only)", () => {
    const out = sanitizeHtml('<svg onload="x()"><circle onclick="x()" /></svg>');
    expect(out).not.toMatch(/onload/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/<svg/i);
    expect(out).not.toMatch(/<circle/i);
  });
});

describe("buildSafeCtaUrl", () => {
  it("returns the base URL when no UTM is provided", () => {
    expect(buildSafeCtaUrl("https://example.com")).toBe("https://example.com");
  });

  it("appends UTM with ? when the URL has no query string", () => {
    expect(buildSafeCtaUrl("https://example.com/p", "utm_source=x")).toBe(
      "https://example.com/p?utm_source=x",
    );
  });

  it("appends UTM with & when the URL already has a query string", () => {
    expect(buildSafeCtaUrl("https://example.com/p?a=1", "utm_source=x")).toBe(
      "https://example.com/p?a=1&utm_source=x",
    );
  });

  it("returns null when the base URL is not http(s)", () => {
    expect(buildSafeCtaUrl("javascript:alert(1)")).toBeNull();
    expect(buildSafeCtaUrl("javascript:alert(1)", "utm_source=x")).toBeNull();
  });

  it("returns null when the base URL is empty / undefined", () => {
    expect(buildSafeCtaUrl(undefined)).toBeNull();
    expect(buildSafeCtaUrl("")).toBeNull();
    expect(buildSafeCtaUrl(null)).toBeNull();
  });
});
