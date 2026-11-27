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
| `offset`    | number? | `16`             | Distance in CSS pixels from both edges of the chosen corner                             |

## How it works

When the player leaves the viewport AND `mediaPlayer.paused` is false, the plugin adds the `playerstack-sticky` class to the container. CSS pins it to the configured corner (bottom-right by default) with a small shadow. A close button is injected that disconnects the observer and removes the sticky state.

## Size

The pinned player is `min(360px, 40vw)` wide, which is 156 px on a 390 px screen. Overlays (CTA, email gate, action bar) stay inside the pinned box and become hard to use at that size; widen it with `.playerstack-sticky { width: ... }`, and use `!important` if the host page sets an inline width on `<player-stack>`.

A fullscreen player is never pinned: entering fullscreen unpins it, and after exit it pins again if it is still out of view and playing.

## Styling

Pick a corner with `position` and `offset`, or override the placement via CSS:

```css
.playerstack-sticky {
  bottom: 24px !important;
  left: 24px !important;
  right: auto !important;
  width: 320px;
}
```

## Events

None.

## License

Apache-2.0.
