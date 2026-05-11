---
layout: ../../../layouts/Docs.astro
title: custom-css — Playerstack
description: Inject arbitrary CSS scoped to a single Playerstack instance — the escape hatch for any styling controls-policy doesn't cover.
---

# custom-css

> npm: [`@playerstack/plugin-custom-css`](https://www.npmjs.com/package/@playerstack/plugin-custom-css)

The escape hatch for any styling that [`controls-policy`](/docs/plugins/controls-policy) (theme color + show/hide controls) doesn't cover. Drop in arbitrary CSS that only affects this `<player-stack>` instance.

## Quickstart

```html
<player-stack
  src="https://example.com/v.mp4"
  data-config='{
    "customCss": {
      "enabled": true,
      "css": "border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); & video { filter: contrast(1.1); }"
    }
  }'
></player-stack>
```

## Config

`config.customCss`:

| Field     | Type      | Default | Description                                                                                           |
| --------- | --------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `enabled` | `boolean` | `false` | Plugin is a no-op unless `true`                                                                       |
| `css`     | `string`  | —       | Raw CSS, automatically scoped to this player instance via CSS Nesting. Use `&` to target descendants. |

## How scoping works

Your CSS is wrapped in `player-stack[data-ps-id="<unique-id>"] { ... }` and injected as a `<style data-playerstack="custom-css">` in `<head>`. Each `<player-stack>` on the page gets its own scope, so styles never leak between instances.

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

## Security

The plugin rejects (renders nothing) when the CSS contains:

- `</style>` — would escape the injected `<style>` block
- `@import` — pulls remote stylesheets, exfiltration / supply-chain risk
- `expression(` — legacy IE; harmless today but signals tampering intent
- `javascript:` — XSS via `url(javascript:…)` in legacy contexts

This plugin is meant for trusted CSS provided by the embedder (config provider, brand settings). Don't pipe arbitrary user input into it without your own validation on top.

## Coordinating with controls-policy

`controls-policy` already manages a `data-ps-id` attribute on the inner media element. `custom-css` reuses the same id — no conflict, no double-id collision.

## Events

None.
