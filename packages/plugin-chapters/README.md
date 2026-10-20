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

| Field               | Type                     | Description                                                                                |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `points`            | `Array<{ time, label }>` | Sorted automatically. Time in seconds. Required                                            |
| `containerSelector` | string?                  | CSS selector to mount the list outside the player; defaults to inside the player container |

The active chapter button gets the `active` class — style it however you want.

## Events

| Name           | Payload           | When                  |
| -------------- | ----------------- | --------------------- |
| `chapter:jump` | `{ time, label }` | User clicks a chapter |

## License

Apache-2.0.
