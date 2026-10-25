# @playerstack/plugin-intro-card

Marketing splash overlay shown **before** the video plays — title, subtitle, badge, optional CTA, custom HTML, and a big play button. Different scope from `branded-thumb` (which handles custom poster + click-to-load). You can use both together. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

The standalone [`playerstack`](https://playerstack.techskills.academy/playerstack.min.js) bundle includes this plugin by default.

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
import { introCardPlugin } from "@playerstack/plugin-intro-card";

Playerstack.use(introCardPlugin).define();
```

```html
<player-stack
  src="https://example.com/v.mp4"
  data-config='{
    "introCard": {
      "enabled": true,
      "badge": "FREE PREVIEW",
      "title": "Lesson 1: Kick-off",
      "subtitle": "5 minutes — what you will learn",
      "cta": { "label": "Buy the course", "url": "https://example.com/course" }
    }
  }'
></player-stack>
```

## Config

`config.introCard`:

| Field         | Type                                   | Default        | Description                                                                    |
| ------------- | -------------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| `enabled`     | `boolean`                              | `false`        | Plugin is a no-op unless `true`                                                |
| `badge`       | `string`                               | —              | Small uppercase pill above the title (e.g. "FREE PREVIEW", "2 of 12")          |
| `title`       | `string`                               | —              | Heading                                                                        |
| `subtitle`    | `string`                               | —              | Supporting line under the title                                                |
| `html`        | `string`                               | —              | Arbitrary trusted HTML inserted between subtitle and play button               |
| `cta`         | `{ label, url, utm? }`                 | —              | Optional click-through link separate from the play button                      |
| `image`       | `string`                               | —              | Background image URL                                                           |
| `position`    | `"fullscreen" \| "bottom" \| "center"` | `"fullscreen"` | Layout: cover the whole player, sit at the bottom, or float as a centered card |
| `theme`       | `"dark" \| "light" \| "transparent"`   | `"dark"`       | Background style                                                               |
| `dismissible` | `boolean`                              | `false`        | Show a close button so the user can skip the card without playing              |

## Behavior

- The play button uses `var(--ps-accent)` from `controls-policy` automatically (or falls back to dark)
- Click play → `play()` on the inner media element + remove overlay + emit `intro-card:play-click`
- Click CTA → emit `intro-card:cta-click`, **does NOT** call play() or remove the overlay (the user is leaving anyway via target=\_blank)
- Click close (when dismissible) → emit `intro-card:dismiss`, remove overlay, **does NOT** play

## Events

| Name                    | Payload                            | When                 |
| ----------------------- | ---------------------------------- | -------------------- |
| `intro-card:play-click` | `undefined`                        | Play button clicked  |
| `intro-card:cta-click`  | `{ label?: string; url?: string }` | CTA link clicked     |
| `intro-card:dismiss`    | `undefined`                        | Close button clicked |

## Security

`html` and `cta.url` are inserted as-is — treat them as trusted strings from your config provider, not user input. `cta.url` must be `http(s)`; other schemes silently drop the link wrapper. The CTA always opens in a new tab with `rel="noopener noreferrer"`.

## How is this different from `branded-thumb`?

|                              | `branded-thumb`                            | `intro-card`                                          |
| ---------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| Use case                     | Custom poster + play button (LCP / GDPR)   | Marketing splash (title, subtitle, CTA)               |
| Visual content               | Image (poster) + button                    | Title + subtitle + badge + custom HTML + button + CTA |
| Click-to-load (defer iframe) | Yes (`clickToLoad: true`)                  | No — loads as usual                                   |
| Combine?                     | Yes — branded-thumb shows under intro-card |

## License

Apache-2.0.

## Keyboard access

Intro cards in fullscreen, center, and bottom positions are bounded by the player height and scroll inside their own overlay when content is too tall. Content stays centered when it fits and begins at the top when it overflows. Keyboard focus and pointer/touch scrolling do not move the player content.

While the card is visible, lower player layers (including branded thumbnails mounted later) are inert and hidden from assistive technology. Dismissal restores their original state and returns owned focus to the previous control or the thumbnail/play/controller fallback. External page focus is preserved.
