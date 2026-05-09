---
layout: ../../../layouts/Docs.astro
title: focus-mode — Playerstack
description: Auto-pause when the user switches tabs.
---

# focus-mode

> npm: [`@playerstack/plugin-focus-mode`](https://www.npmjs.com/package/@playerstack/plugin-focus-mode)

Auto-pause the video when the user switches tabs or minimizes the window. Optionally resume when the tab becomes visible again.

## Quickstart

```html
<player-stack
  src="https://example.com/lesson.mp4"
  data-config='{ "focusMode": { "enabled": true, "resumeOnVisible": true } }'
>
</player-stack>
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

E-learning — keeps students from playing the lesson in a background tab to fake "watched" completion. The video literally cannot progress if the tab isn't focused.

## Implementation note

Listens to `document.visibilitychange`, the standard browser API. Works across desktop and mobile browsers. No timers, no polling.
