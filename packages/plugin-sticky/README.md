# @playerstack/plugin-sticky

Pin the player to a corner of the viewport when the user scrolls past it while it's playing. Includes a close button. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://playerstack.techskills.academy/playerstack.min.js) bundle.

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

```html
<player-stack
  src="https://example.com/v.mp4"
  data-config='{ "sticky": { "enabled": true } }'
>
</player-stack>
```

## Config

`config.sticky`:

| Field       | Type    | Default          | Description                                                                             |
| ----------- | ------- | ---------------- | --------------------------------------------------------------------------------------- |
| `enabled`   | boolean | `false`          | Plugin is a no-op unless `true`                                                         |
| `threshold` | number? | `0.15`           | IntersectionObserver threshold — how much of the player must remain in view             |
| `position`  | string? | `"bottom-right"` | `"bottom-right"`, `"bottom-left"`, `"top-right"` or `"top-left"` corner of the viewport |
| `offset`    | number? | `16`             | Distance from the corner edges in px; on narrow screens, the bottom gap (default 8)     |

## How it works

When the player leaves the viewport AND `mediaPlayer.paused` is false, the plugin adds the `playerstack-sticky` class to the container. CSS pins it to the configured corner (bottom-right by default) with a small shadow. A close button is injected that disconnects the observer and removes the sticky state.

A fullscreen player is never pinned: entering fullscreen unpins it, and after exit it pins again if it is still out of view and playing.

## Size

| Viewport          | Pinned player                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| 600 px and wider  | `min(360px, 40vw)` wide, 16:9, in the configured corner                                                  |
| Narrower (phones) | Full width at the bottom with 8 px gaps plus `env(safe-area-inset-*)`, 16:9 (374×210 on a 390 px screen) |

On a narrow screen `position` does not apply and `offset` sets only the gap under the player (for example to clear a bottom navigation bar). Safe-area insets are non-zero only when the page uses `viewport-fit=cover`.

While a CTA card, e-mail form or intro card is open, the pinned player grows to `min(60dvh, 420px)` so its buttons are visible without scrolling; it shrinks back when the overlay closes. Longer texts, or very short screens, scroll inside the overlay. The close button (44 px) stays clickable above every overlay, and the plugin never scrolls the page.

The pinned player is never wider than the screen, even with an inline width on `<player-stack>`. To change its width, use `!important` and a selector stronger than the plugin's own:

```css
player-stack.playerstack-sticky.playerstack-sticky {
  width: 320px !important;
}
```

On a narrow screen add `left: auto !important` if the player should no longer span the screen.

## Styling

Pick a corner with `position` and `offset`, or override the placement via CSS:

```css
@media (min-width: 600px) {
  .playerstack-sticky {
    bottom: 24px !important;
    left: 24px !important;
    right: auto !important;
  }
}
```

## Events

None.

## License

Apache-2.0.
