---
layout: ../../../layouts/Docs.astro
title: chapters — Playerstack
description: Clickable chapter list that syncs with playback time.
---

# chapters

> npm: [`@playerstack/plugin-chapters`](https://www.npmjs.com/package/@playerstack/plugin-chapters)

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

| Field               | Type                     | Description                                                                                |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `points`            | `Array<{ time, label }>` | Sorted automatically. Time in seconds. Required                                            |
| `containerSelector` | string?                  | CSS selector to mount the list outside the player; defaults to inside the player container |

## Active chapter styling

The currently-active chapter button gets the `active` class. Style with the accent color:

```css
.playerstack-chapter.active {
  background: var(--ps-accent, #008aff);
  color: #fff;
}
```

## Events

| Name           | Payload           | When                  |
| -------------- | ----------------- | --------------------- |
| `chapter:jump` | `{ time, label }` | User clicks a chapter |

## Use cases

- **Course lessons** — let students skip to the section they need
- **Long-form content** — table of contents for tutorials
- **Podcast video** — jump to topics
