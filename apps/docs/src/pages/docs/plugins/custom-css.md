---
layout: ../../../layouts/Docs.astro
title: custom-css — Playerstack
description: Two-tier styling for Playerstack — safe theme tokens for untrusted input, raw CSS escape hatch for developer-authored stylesheets.
---

# custom-css

> Package: `@playerstack/plugin-custom-css` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-custom-css)), not published to npm yet

Two-tier styling on top of [`controls-policy`](/docs/plugins/controls-policy):

1. **`tokens`** — a safe, validated CSS-custom-property API. Use this for any theming that comes from a CMS, SaaS dashboard, or untrusted JSON.
2. **`trustedCss`** — a raw-CSS escape hatch for developer-authored stylesheets. Requires an explicit `acknowledgeTrusted: true`.

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

Without `acknowledgeTrusted: true` the raw CSS is dropped and a console warning is logged. This is intentional: raw CSS on a third-party embed is enough to swap brand colors, hide controls, or shift layout, so we want the call site to declare trust explicitly.

## Config

`config.customCss`:

| Field                | Type                     | Default | Description                                                                                                                        |
| -------------------- | ------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`            | `boolean`                | `false` | Plugin is a no-op unless `true`                                                                                                    |
| `tokens`             | `Record<string, string>` | `{}`    | Safe theming. Keys must be `--ps-*`. Values are validated; unsafe entries silently dropped.                                        |
| `trustedCss`         | `string`                 | —       | Raw CSS, scoped to this player instance via CSS Nesting. Requires `acknowledgeTrusted: true`.                                      |
| `acknowledgeTrusted` | `boolean`                | `false` | Required to apply `trustedCss`. The verbose name is intentional.                                                                   |
| `css`                | `string`                 | —       | _Deprecated._ Same shape as `trustedCss` but logs a warning. Still gated on `acknowledgeTrusted: true`. Removed in a future major. |

## How scoping works

`trustedCss` is wrapped in `player-stack:has([data-ps-id="<unique-id>"]) { ... }` and injected as a `<style data-playerstack="custom-css">` in `<head>`. Each `<player-stack>` on the page gets its own scope, so styles never leak between instances.

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
