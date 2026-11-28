import { describe, expect, it } from "vitest";
import { sanitizeCustomCss, scopeCustomCss, validateTokenValue, validateTokens } from "./sanitize";

describe("sanitizeCustomCss", () => {
  it("returns the trimmed CSS unchanged for safe input", () => {
    expect(sanitizeCustomCss("  & video { filter: grayscale(1); }  ")).toBe(
      "& video { filter: grayscale(1); }",
    );
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(sanitizeCustomCss("")).toBeNull();
    expect(sanitizeCustomCss("   \n\t  ")).toBeNull();
  });

  it("returns null when input contains </style> (case-insensitive)", () => {
    expect(sanitizeCustomCss("color: red; </style><x>")).toBeNull();
    expect(sanitizeCustomCss("</STYLE >")).toBeNull();
  });

  it("returns null when input contains @import", () => {
    expect(sanitizeCustomCss("@import url('https://example.com/x.css');")).toBeNull();
    expect(sanitizeCustomCss("  @IMPORT 'remote.css';  ")).toBeNull();
  });

  it("returns null when input contains expression(", () => {
    expect(sanitizeCustomCss("color: expression(x);")).toBeNull();
  });

  it("returns null when input contains javascript: URLs", () => {
    expect(sanitizeCustomCss("background: url(javascript:x);")).toBeNull();
  });

  it("allows @media / @supports / @keyframes (legitimate at-rules)", () => {
    const css = "@media (min-width: 600px) { & video { width: 100%; } }";
    expect(sanitizeCustomCss(css)).toBe(css);
  });

  it("returns null when a top-level } appears before its matching {", () => {
    expect(sanitizeCustomCss("color: red; } body { background: red;")).toBeNull();
  });

  it("returns null when braces are not balanced", () => {
    expect(sanitizeCustomCss("& video { width: 100%;")).toBeNull();
  });

  it("ignores braces inside string literals", () => {
    const css = "& video::after { content: '} }'; }";
    expect(sanitizeCustomCss(css)).toBe(css);
  });

  it("ignores braces inside comments", () => {
    const css = "& video { /* } } } */ width: 100%; }";
    expect(sanitizeCustomCss(css)).toBe(css);
  });

  it("returns null when a string or comment is not closed on its line", () => {
    expect(sanitizeCustomCss('color: "\n} #site-header { visibility: hidden }')).toBeNull();
    expect(sanitizeCustomCss("& video::after { content: 'open; }")).toBeNull();
    expect(sanitizeCustomCss("& video { width: 100%; } /* open")).toBeNull();
  });

  it("returns null for selectors that reach elements outside the player", () => {
    for (const css of [
      ":not(&):is(#site-header) { visibility: hidden }",
      ":is(&) p { color: red }",
      ":where(.x, &) p { color: red }",
      "& ~ p { color: red }",
      "&+div { color: red }",
      "& video { color: red } ~ footer { color: red }",
      "+ div { color: red }",
      "& video, ~ aside { color: red }",
      "@media (min-width: 1px) { :not(&) { color: red } }",
    ]) {
      expect(sanitizeCustomCss(css), css).toBeNull();
    }
  });

  it("keeps selectors that stay inside the player", () => {
    for (const css of [
      "& video { width: 100%; }",
      "& > media-control-bar { opacity: 0.8 }",
      "&:hover video { filter: none }",
      "&:not(.paused) media-control-bar { opacity: 1 }",
      ".dark & { border: 1px solid #fff }",
      "& li + li, & li ~ li { margin: 0 }",
      "& :is(video, img) { object-fit: cover }",
      "transition: opacity 0.2s, transform calc(1s + 2s);",
      "@supports (display: grid) { & video { display: block } }",
      "@container (min-width: 400px) { & video { width: 50% } }",
      "@layer brand { & video { width: 50% } }",
      "@keyframes ps-pulse { from { opacity: 0 } to { opacity: 1 } }",
    ]) {
      expect(sanitizeCustomCss(css), css).toBe(css);
    }
  });

  it("returns null for at-rules other than @media, @supports, @container, @layer and @keyframes", () => {
    expect(sanitizeCustomCss("@scope (html) { p { color: red } }")).toBeNull();
    expect(sanitizeCustomCss("@page { margin: 0 }")).toBeNull();
  });

  it("returns null when input contains url()", () => {
    expect(sanitizeCustomCss("background: url('https://example.com/p.gif');")).toBeNull();
    expect(sanitizeCustomCss("background: URL(/local.png);")).toBeNull();
  });

  it("returns null for image-set() and @font-face / @namespace / @charset", () => {
    expect(sanitizeCustomCss("background: image-set(url(x.png) 1x);")).toBeNull();
    expect(sanitizeCustomCss("@font-face { font-family: x; src: url(f.woff2); }")).toBeNull();
    expect(sanitizeCustomCss("@namespace svg url('http://www.w3.org/2000/svg');")).toBeNull();
    expect(sanitizeCustomCss('@charset "utf-8";')).toBeNull();
  });

  it("returns null for any input containing a backslash", () => {
    expect(
      sanitizeCustomCss("#x { background-image: u\\72l(https://example.com/p.png); }"),
    ).toBeNull();
    expect(sanitizeCustomCss('@\\69mport "https://example.com/x.css";')).toBeNull();
    expect(sanitizeCustomCss('& video::after { content: "\\2014"; }')).toBeNull();
  });
});

describe("validateTokenValue", () => {
  it("accepts hex/rgb/rgba colors, lengths, and keywords", () => {
    expect(validateTokenValue("#008aff")).toBe(true);
    expect(validateTokenValue("rgba(0, 128, 255, 0.8)")).toBe(true);
    expect(validateTokenValue("8px")).toBe(true);
    expect(validateTokenValue("1.5rem")).toBe(true);
    expect(validateTokenValue("inherit")).toBe(true);
    expect(validateTokenValue("none")).toBe(true);
  });

  it("returns false for empty, non-string, or too-long values", () => {
    expect(validateTokenValue("")).toBe(false);
    expect(validateTokenValue("   ")).toBe(false);
    expect(validateTokenValue(undefined as unknown as string)).toBe(false);
    expect(validateTokenValue("x".repeat(257))).toBe(false);
  });

  it("returns false for values that contain `;`, `{}`, `@`, url(), or backslash", () => {
    expect(validateTokenValue("red; background: red")).toBe(false);
    expect(validateTokenValue("red} body { background: red")).toBe(false);
    expect(validateTokenValue("@import 'x'")).toBe(false);
    expect(validateTokenValue("url('x')")).toBe(false);
    expect(validateTokenValue("image-set(url(x) 1x)")).toBe(false);
    expect(validateTokenValue("expression(alert(1))")).toBe(false);
    expect(validateTokenValue("javascript:alert(1)")).toBe(false);
    expect(validateTokenValue("</style><script>")).toBe(false);
    expect(validateTokenValue("a\\")).toBe(false);
  });
});

describe("validateTokens", () => {
  it("keeps only --ps-* names with values that pass validateTokenValue", () => {
    const out = validateTokens({
      "--ps-accent": "#008aff",
      "--ps-radius": "8px",
      "--evil": "red",
      "background-color": "red",
      "--ps-bad": "url(x)",
      "--ps-num": 42 as unknown as string,
    });
    expect(out).toEqual([
      ["--ps-accent", "#008aff"],
      ["--ps-radius", "8px"],
    ]);
  });

  it("returns [] for null / undefined / non-object input", () => {
    expect(validateTokens(undefined)).toEqual([]);
    expect(validateTokens(null)).toEqual([]);
    expect(validateTokens("nope" as unknown as Record<string, unknown>)).toEqual([]);
  });
});

describe("scopeCustomCss", () => {
  it("wraps the css in the given scope using CSS Nesting", () => {
    const css = "& video { filter: grayscale(1); }";
    expect(scopeCustomCss(css, 'player-stack[data-ps-id="ps-1"]')).toBe(
      'player-stack[data-ps-id="ps-1"] {\n& video { filter: grayscale(1); }\n}',
    );
  });

  it("preserves at-rules inside the wrapper", () => {
    const css = "@media (min-width: 600px) { & .control { background: red; } }";
    const out = scopeCustomCss(css, 'player-stack[data-ps-id="ps-2"]');
    expect(out.startsWith('player-stack[data-ps-id="ps-2"] {')).toBe(true);
    expect(out).toContain("@media (min-width: 600px)");
  });
});
