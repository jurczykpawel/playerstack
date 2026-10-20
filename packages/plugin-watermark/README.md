# @playerstack/plugin-watermark

Corner-pinned logo or text overlay for [Playerstack](https://github.com/jurczykpawel/playerstack). Useful for branding, attribution, or "©" notices.

The standalone [`playerstack`](https://playerstack.techskills.academy/playerstack.min.js) bundle includes this plugin by default — use this package directly only if you're using `@playerstack/core` and composing your own bundle.

## Install

This plugin is included in the standalone script, so there is nothing to install:

```html
<script
  src="https://playerstack.techskills.academy/playerstack.min.js"
  defer
></script>
```

The `@playerstack/*` packages are not published to npm yet; to compose your own bundle, build it from this repository.

## Use

```ts
import { Playerstack } from "@playerstack/core";
import { watermarkPlugin } from "@playerstack/plugin-watermark";

Playerstack.use(watermarkPlugin).define();
```

```html
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{"watermark":{"enabled":true,"src":"https://example.com/logo.png","position":"top-right","width":80,"opacity":0.7}}'
></player-stack>
```

## Config

`config.watermark`:

| Field      | Type                                                           | Default          | Description                                                                   |
| ---------- | -------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `enabled`  | `boolean`                                                      | `false`          | Plugin is a no-op unless `true`                                               |
| `src`      | `string`                                                       | —                | Image URL. Mutually exclusive with `text`                                     |
| `text`     | `string`                                                       | —                | Plain-text overlay (e.g. `© ACME 2026`). Mutually exclusive with `src`        |
| `href`     | `string`                                                       | —                | Optional click-through URL. Must be `http(s)`; other schemes silently ignored |
| `position` | `"top-left" \| "top-right" \| "bottom-left" \| "bottom-right"` | `"bottom-right"` | Corner placement                                                              |
| `opacity`  | `number`                                                       | `0.7`            | 0–1; out-of-range clamped, invalid falls back to default                      |
| `margin`   | `number`                                                       | `16`             | Distance from the corner in pixels                                            |
| `width`    | `number`                                                       | `80`             | Image width in px (only when `src` is set)                                    |

## Behavior

- Image mode (`src`): a styled `<img>` with `loading="lazy"` and `decoding="async"`
- Text mode (`text`): a small pill with semi-transparent background and white text
- When `href` is set, the overlay is wrapped in `<a target="_blank" rel="noopener noreferrer">`
- `pointer-events: auto` so the link is clickable; the rest of the player still receives mouse events outside the badge

## Security

`href` is validated as `http:` or `https:`. Anything else (`javascript:`, `data:`, `file:`, etc.) is silently dropped — the overlay still renders, just without the link wrapper.

## License

Apache-2.0.
