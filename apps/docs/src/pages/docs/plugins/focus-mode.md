---
layout: ../../../layouts/Docs.astro
title: focus-mode — Playerstack
description: Auto-pause when the user switches tabs.
---

# focus-mode

> Package: `@playerstack/plugin-focus-mode` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-focus-mode)), not published to npm yet

Auto-pause the video when the user switches tabs or minimizes the window. Optionally resume when the tab becomes visible again.

Not included in the standalone `playerstack.min.js` bundle: it needs a custom bundle built from the repository (see [Getting started](/docs/getting-started/)).

## Quickstart

```html
<player-stack
  src="https://example.com/lesson.mp4"
  data-config='{ "focusMode": { "enabled": true, "resumeOnVisible": true } }'
></player-stack>
```

## Config

`config.focusMode`:

| Field             | Type     | Default | Description                                                              |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `enabled`         | boolean  | `false` | Plugin is a no-op unless `true`                                          |
| `resumeOnVisible` | boolean? | `false` | Resume play when the tab becomes visible (only if it was playing before) |

## Events

| Name                 | Payload     | When                           |
| -------------------- | ----------- | ------------------------------ |
| `focus-mode:hidden`  | `undefined` | Document becomes hidden        |
| `focus-mode:visible` | `undefined` | Document becomes visible again |

## Use case

E-learning: keeps students from playing the lesson in a background tab to fake completion.

## Implementation note

Listens to `document.visibilitychange`. While the tab is hidden it also disables the browser's automatic Picture-in-Picture, which would otherwise keep the video playing.
