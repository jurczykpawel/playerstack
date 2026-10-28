# @playerstack/plugin-autopreview

Muted autoplay when the player enters the viewport, pause when it leaves; optionally a separate light preview clip under the play button. Respects `prefers-reduced-motion`. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

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

```ts
import { Playerstack } from "@playerstack/core";
import { autopreviewPlugin } from "@playerstack/plugin-autopreview";

Playerstack.use(autopreviewPlugin).define();
```

```html
<player-stack
  src="https://example.com/preview.mp4"
  data-config='{"preview":{"enabled":true,"threshold":0.6}}'
>
</player-stack>
```

## Config

`config.preview`:

| Field                  | Type              | Default | Description                                                       |
| ---------------------- | ----------------- | ------- | ----------------------------------------------------------------- |
| `enabled`              | `boolean`         | `false` | Plugin is a no-op unless `true`                                   |
| `threshold`            | `number` `[0..1]` | `0.5`   | How much of the player must be in view before play is triggered   |
| `loopUntilInteraction` | `boolean`         | `true`  | Loop the preview; `false` plays it once                           |
| `src`                  | `string`          | —       | Separate light preview clip (absolute or page-relative http(s))   |
| `type`                 | `string`          | —       | MIME type of `src`; the preview is skipped if it cannot be played |

## Behavior

- When at least `threshold` of the player is visible, sets `mediaPlayer.muted = true` and calls `play()`.
- When the player leaves the viewport, calls `pause()`.
- If the user has `prefers-reduced-motion: reduce`, the plugin **does nothing** — no observer, no autoplay.

- If top-level `preload` is `"none"`, preview is disabled so viewport entry does not start a media request. User playback remains available.

## Light preview clip (`preview.src`)

A short muted loop plays under the play button until the viewer clicks; the click starts the full video from 0:00 with sound and controls. Requires `brandedThumb` with `enabled` and `clickToLoad`, so the full source is not requested before the click (the plugin logs a console warning otherwise):

```html
<player-stack
  src="https://example.com/full-video.mp4"
  data-config='{
    "poster": "https://example.com/poster.jpg",
    "preview": { "enabled": true, "src": "https://example.com/preview-3s.mp4", "type": "video/mp4" },
    "brandedThumb": { "enabled": true, "clickToLoad": true, "playLabel": "Watch the video" }
  }'
>
</player-stack>
```

- The preview is a separate `<video class="playerstack-preview">`: muted, `playsinline`, `aria-hidden`, out of the Tab order, no controls. It is mounted on first view inside the thumbnail, above the poster and below the play button, and its `src` is assigned only then. Off-screen players fetch nothing.
- In view it plays, out of view it pauses.
- Clicking the thumbnail (mouse, Enter, Space) stops the preview, removes its `src` and calls `load()` to abort the download, then removes it. The full video loads, starts from 0:00 unmuted and the controls appear. The click always unmutes, even when media-chrome remembers an earlier mute from the viewer, regardless of `unmuteOnPlay` and `restartOnPlay`; it also overrides a position restored by `savedPosition` (which keeps saving progress); a mute the viewer picks after playback starts is kept. Focus follows the branded-thumb rules.
- `prefers-reduced-motion: reduce` or `preload: "none"`: no preview element and no preview request; the thumbnail shows the static poster.
- Core does not apply `muted`/`autoplay`/`loop` to the main media when `preview.src` is set.
- Keep the clip short and small (for example 3 s, 320 px, no audio, H.264 baseline with `+faststart`, ~15-30 KB).

## Events

None.

## License

Apache-2.0.
