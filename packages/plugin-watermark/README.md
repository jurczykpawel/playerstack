# @playerstack/plugin-watermark

Logo or text overlay, pinned to a corner or moving, for [Playerstack](https://github.com/jurczykpawel/playerstack). Useful for branding, attribution, or "©" notices.

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

| Field            | Type                                                           | Default          | Description                                                                     |
| ---------------- | -------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------- |
| `enabled`        | `boolean`                                                      | `false`          | Plugin is a no-op unless `true`                                                 |
| `src`            | `string`                                                       | —                | Image URL. Mutually exclusive with `text`                                       |
| `text`           | `string`                                                       | —                | Plain-text overlay (e.g. `© ACME 2026`). Mutually exclusive with `src`          |
| `href`           | `string`                                                       | —                | Optional click-through URL. Must be `http(s)`; other schemes silently ignored   |
| `position`       | `"top-left" \| "top-right" \| "bottom-left" \| "bottom-right"` | `"bottom-right"` | Corner placement                                                                |
| `opacity`        | `number`                                                       | `0.7`            | 0–1; out-of-range clamped, invalid falls back to default                        |
| `margin`         | `number`                                                       | `16`             | Distance from corner in px; see bottom corners below                            |
| `width`          | `number`                                                       | `80`             | Image width in px (only when `src` is set)                                      |
| `moveInterval`   | `number`                                                       | off              | Seconds between moves to a random spot (at least 1). `position` is then ignored |
| `moveTransition` | `"smooth" \| "jump"`                                           | `"smooth"`       | Glide to the next spot (0.8 s) or jump there                                    |
| `reinsert`       | `boolean`                                                      | `false`          | Put the overlay back if it is removed from the player                           |

## Viewer identifier that moves

For paid lessons, the host page can show who is watching and move the label around, so a screen recording points back to the account it was made from. The player prints `text` exactly as given: it has no placeholders and looks nothing up, so your page (or your backend, for example through the Sellf adapter) must put the final string into the config.

```js
// `buyer` and `lesson` come from your own signed-in session.
const player = document.createElement("player-stack");
player.setAttribute("src", lesson.src);
player.setAttribute(
  "data-config",
  JSON.stringify({
    watermark: {
      enabled: true,
      text: buyer.email,
      opacity: 0.5,
      moveInterval: 10,
      reinsert: true,
    },
  }),
);
document.querySelector("#lesson").append(player);
```

Build the attribute with `JSON.stringify` and `setAttribute` as above, or escape it properly in your server template; do not concatenate viewer data into HTML.

- A random spot is picked at start and after every interval. The overlay stays inside the frame by `margin` and above the control bar (`--ps-control-bar-clearance`), inline and in fullscreen. It can pass over other overlays inside the frame, such as the top or bottom action bar.
- With `prefers-reduced-motion: reduce` the overlay jumps without animation; it still changes place.
- Without `href`, clicks pass through the overlay. A linked watermark that moves can catch clicks anywhere in the frame, so leave `href` out for viewer identifiers.

### Privacy

An email address or order number on screen is personal data, visible to anyone who can see the screen and present in every screenshot or recording. Whether to show it, what to show (a short order or account ID is often enough) and how to tell viewers is the host's decision and responsibility. The plugin does not send or store it.

### Limits

This is a deterrent, not DRM:

- It is ordinary HTML over the video. It is not burned into the file, so anyone who gets the video URL or file gets it without the watermark.
- `reinsert` restores the overlay after its element is removed from `<player-stack>`. It does not stop anyone from hiding it with CSS or developer tools, editing its content, removing the player or changing your page's scripts. Recordings can also be cropped or blurred.
- On iPhone, Safari offers only the native fullscreen of the video itself, which hides every HTML overlay, including this one. Picture-in-picture windows show only the video too.

## Behavior

- Image mode (`src`): a styled `<img>` with `loading="lazy"` and `decoding="async"`
- Text mode (`text`): a small pill with semi-transparent background and white text
- When `href` is set, the overlay is wrapped in `<a target="_blank" rel="noopener noreferrer">`
- Only a linked watermark (`href`) takes pointer events; without a link, clicks pass through to the player
- Bottom corners stay above the control bar: the distance from the bottom edge is the larger of `margin` and `--ps-control-bar-clearance` (default `48px`). Override it on `player-stack`, for example `player-stack { --ps-control-bar-clearance: 0px; }` when the control bar is hidden, or raise it for a taller custom bar
- Visible in fullscreen, because the whole `<player-stack>` goes fullscreen (not in the native iPhone video fullscreen, see [Fullscreen](https://playerstack.techskills.academy/docs/api#fullscreen))

## Security

`href` is validated as `http:` or `https:`. Anything else (`javascript:`, `data:`, `file:`, etc.) is silently dropped — the overlay still renders, just without the link wrapper.

## License

Apache-2.0.
