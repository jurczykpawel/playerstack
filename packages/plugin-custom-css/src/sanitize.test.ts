import { describe, expect, it } from "vitest";
import { sanitizeCustomCss, scopeCustomCss } from "./sanitize";

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
    expect(sanitizeCustomCss("color: red; </style><script>alert(1)</script>")).toBeNull();
    expect(sanitizeCustomCss("</STYLE >")).toBeNull();
  });

  it("returns null when input contains @import", () => {
    expect(sanitizeCustomCss("@import url('https://evil.test/styles.css');")).toBeNull();
    expect(sanitizeCustomCss("  @IMPORT 'remote.css';  ")).toBeNull();
  });

  it("returns null when input contains expression(", () => {
    expect(sanitizeCustomCss("color: expression(alert(1));")).toBeNull();
  });

  it("returns null when input contains javascript: URLs", () => {
    expect(sanitizeCustomCss("background: url(javascript:alert(1));")).toBeNull();
  });

  it("allows @media / @supports / @keyframes (legitimate at-rules)", () => {
    const css = "@media (min-width: 600px) { & video { width: 100%; } }";
    expect(sanitizeCustomCss(css)).toBe(css);
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
