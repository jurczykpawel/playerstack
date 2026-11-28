---
layout: ../../../layouts/Docs.astro
title: custom-css — Playerstack
description: Two-tier styling for Playerstack — safe theme tokens for untrusted input, raw CSS escape hatch for developer-authored stylesheets.
---

# custom-css

> Package: `@playerstack/plugin-custom-css` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-custom-css)), not published to npm yet

Two-tier styling on top of [`controls-policy`](/docs/plugins/controls-policy):

1. **`tokens`** — a safe, validated CSS-custom-property API. Use this for any theming that comes from a CMS, SaaS dashboard, or untrusted JSON.
2. **`trustedCss`** — a raw-CSS escape hatch for developer-authored stylesheets. Requires `acknowledgeTrusted: true` and the site owner's consent: the `data-allow-trusted-css` attribute on the PlayerStack `<script>` tag.

## Quickstart — safe tokens

```html
<player-stack
  src="https://example.com/v.mp4"
  data-config='{
    "customCss": {
      "enabled": true,
      "tokens": {
        "--ps-accent": "#008aff",
        "--ps-radius": "12px"
      }
    }
  }'
></player-stack>
```

## Quickstart — trusted raw CSS

```html
<script
  src="https://playerstack.techskills.academy/playerstack.min.js"
  data-allow-trusted-css
  defer
></script>

<player-stack
  src="https://example.com/v.mp4"
  data-config='{
    "customCss": {
      "enabled": true,
      "trustedCss": "border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); & video { filter: contrast(1.1); }",
      "acknowledgeTrusted": true
    }
  }'
></player-stack>
```

Without `acknowledgeTrusted: true`, or without `data-allow-trusted-css` on a `<script>` element of the page, the raw CSS is dropped and a console warning is logged. `data-config` can be written by people who may not run scripts on the page (CMS editors, shortcode fields), and raw CSS is enough to hide, cover or restyle the whole page. The attribute lives on the script tag, which only the site owner controls. In your own bundle, register `createCustomCssPlugin({ allowTrustedCss: true })` instead of the attribute.

CSS containing a backslash (for example `content: "\""`) is always rejected; write such characters directly or use `tokens`.

### Migrating from earlier versions

Embeds that set `trustedCss` (or the deprecated `css`) in `data-config` must add `data-allow-trusted-css` to their PlayerStack `<script>` tag. Nothing else changes: `acknowledgeTrusted: true` is still required and `tokens` work without the attribute.

## Config

`config.customCss`:

| Field                | Type                     | Default | Description                                                                                                                        |
| -------------------- | ------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`            | `boolean`                | `false` | Plugin is a no-op unless `true`                                                                                                    |
| `tokens`             | `Record<string, string>` | `{}`    | Safe theming. Keys must be `--ps-*`. Values are validated; unsafe entries silently dropped.                                        |
| `trustedCss`         | `string`                 | —       | Raw CSS, scoped to this player instance via CSS Nesting. Requires `acknowledgeTrusted: true` and `data-allow-trusted-css`.         |
| `acknowledgeTrusted` | `boolean`                | `false` | Required to apply `trustedCss`. The verbose name is intentional.                                                                   |
| `css`                | `string`                 | —       | _Deprecated._ Same shape as `trustedCss` but logs a warning. Still gated on `acknowledgeTrusted: true`. Removed in a future major. |

## How scoping works

`trustedCss` is wrapped in `player-stack:has([data-ps-id="<unique-id>"]) { ... }` and injected as a `<style data-playerstack="custom-css">` in `<head>`. Each `<player-stack>` on the page gets its own scope, so styles never leak between instances. CSS that could style elements outside the player is dropped as a whole, with the same console warning as other rejected CSS: `&` inside a pseudo-class (`:not(&)`, `:is(&)`), a sibling combinator after the player (`& ~ p`, `& + div`, or a bare `~ p`), a string or comment left open, and at-rules other than `@media`, `@supports`, `@container`, `@layer` and `@keyframes`.

The wrapper uses native CSS Nesting (browser baseline since 2023). Inside your CSS you can:

```css
/* style the player root itself */
border-radius: 16px;

/* descend with & */
& video {
  filter: grayscale(1);
}

& media-control-bar {
  background: rgba(0, 0, 0, 0.8);
}

/* at-rules nest naturally */
@media (min-width: 800px) {
  & .playerstack-watermark {
    width: 120px;
  }
}
```

## Common patterns

```js
// Frosted control bar
"& media-control-bar { background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); }";

// Bigger play button
"& media-play-button { --media-button-icon-width: 48px; }";

// Cinema mode (rounded + shadow)
"border-radius: 12px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.5);";

// Force a thicker progress bar
"& media-time-range { --media-range-track-height: 6px; }";
```

## Coordinating with controls-policy

`controls-policy` already manages a `data-ps-id` attribute on the inner media element. `custom-css` reuses the same id — no conflict, no double-id collision.

## Events

None.
