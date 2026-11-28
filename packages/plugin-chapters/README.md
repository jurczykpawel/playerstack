# @playerstack/plugin-chapters

Render a clickable chapter list under the player. Active chapter highlights as playback progresses; clicking a chapter jumps `currentTime`. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

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
  src="https://example.com/lesson.mp4"
  data-config='{
    "chapters": {
      "points": [
        { "time": 0,   "label": "Intro" },
        { "time": 60,  "label": "Setup" },
        { "time": 240, "label": "Build the API" },
        { "time": 720, "label": "Deploy" }
      ]
    }
  }'
>
</player-stack>
```

## Config

`config.chapters`:

| Field               | Type                     | Description                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `points`            | `Array<{ time, label }>` | Sorted automatically. Time in seconds. Required                                                                                                                                                                                                                                                    |
| `containerSelector` | string?                  | CSS selector of a layout container to mount the list in; defaults to right after `<player-stack>`. Links, buttons, labels, `<summary>` and form fields (or anything inside them) are not used: the list then goes after the player, with a console warning, as for an invalid or missing selector. |
| `markers`           | boolean?                 | Chapter markers and titles on the progress bar. Default `false`                                                                                                                                                                                                                                    |
| `menu`              | boolean?                 | Chapters button with a menu in the control bar. Default `false`                                                                                                                                                                                                                                    |
| `menuLabel`         | string?                  | Accessible name of that button; set it in the page language. Default `Chapters`                                                                                                                                                                                                                    |

The active chapter button gets the `active` class — style it however you want.

## Progress bar markers and menu

```json
{
  "chapters": {
    "markers": true,
    "menu": true,
    "points": [
      { "time": 0, "label": "Intro" },
      { "time": 60, "label": "Setup" }
    ]
  }
}
```

With `markers: true` the progress bar is split where each chapter starts:

- Hovering the bar shows the chapter title above the time.
- Keyboard focus on the seek slider shows the title at the playhead, and screen readers hear it after the time.
- A click within 6 px of a marker jumps to the exact chapter start. Other clicks and drags seek as usual.

Markers on the bar are not separate buttons, so they never get in the way of seeking and chapters close to each other do not produce tiny targets. For a large, focusable target per chapter use the list under the player or `menu: true`, which adds a button next to fullscreen; Escape closes the menu.

Markers need a known duration, so they appear once the video's metadata has loaded. Points with a negative or non-numeric time are left off the bar and the menu, and points past the end draw no marker. Hiding `progress` with `controls.show` hides the markers with the bar.

Both options are off by default, so existing embeds keep their progress bar and control bar.

## Events

| Name           | Payload           | When                  |
| -------------- | ----------------- | --------------------- |
| `chapter:jump` | `{ time, label }` | User clicks a chapter |

## License

Apache-2.0.
