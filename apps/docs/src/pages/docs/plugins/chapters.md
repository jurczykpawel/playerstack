---
layout: ../../../layouts/Docs.astro
title: chapters — Playerstack
description: Clickable chapter list that syncs with playback time.
---

# chapters

> Package: `@playerstack/plugin-chapters` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-chapters)), not published to npm yet

Render a clickable chapter list under (or anywhere around) the player. Active chapter highlights as `currentTime` advances; clicking a chapter jumps to it.

## Quickstart

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

| Field               | Type                     | Description                                                                        |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| `points`            | `Array<{ time, label }>` | Sorted automatically. Time in seconds. Required                                    |
| `containerSelector` | string?                  | CSS selector to mount the list elsewhere; defaults to right after `<player-stack>` |
| `markers`           | boolean?                 | Chapter markers and titles on the progress bar. Default `false`                    |
| `menu`              | boolean?                 | Chapters button with a menu in the control bar. Default `false`                    |
| `menuLabel`         | string?                  | Accessible name of that button; set it in the page language. Default `Chapters`    |

## Active chapter styling

The currently-active chapter button gets the `active` class. Style with the accent color:

```css
.playerstack-chapter.active {
  background: var(--ps-accent, #008aff);
  color: #fff;
}
```

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

## Use cases

- **Course lessons** — let students skip to the section they need
- **Long-form content** — table of contents for tutorials
- **Podcast video** — jump to topics
