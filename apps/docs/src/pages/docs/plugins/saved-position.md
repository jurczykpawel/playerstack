---
layout: ../../../layouts/Docs.astro
title: saved-position — Playerstack
description: Resume watching from where the visitor left off.
---

# saved-position

> Package: `@playerstack/plugin-saved-position` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-saved-position)), not published to npm yet

Stores `currentTime` in `localStorage` (debounced) and restores it when the same video is loaded again. Clears storage on `ended` so finished videos don't stale-resume. No backend required.

## Quickstart

```html
<player-stack
  src="https://example.com/lesson.mp4"
  data-config='{ "savedPosition": { "enabled": true } }'
>
</player-stack>
```

## Config

`config.savedPosition`:

| Field          | Type    | Default             | Description                                                              |
| -------------- | ------- | ------------------- | ------------------------------------------------------------------------ |
| `enabled`      | boolean | `false`             | Plugin is a no-op unless `true`                                          |
| `keyPrefix`    | string? | `"playerstack:pos"` | Full key is `${keyPrefix}:${src}`                                        |
| `throttleMs`   | number? | `1000`              | Debounce window for save calls                                           |
| `endTolerance` | number? | `5`                 | Don't restore if saved time is within `endTolerance` seconds of duration |

## How it works

- On `timeupdate`, schedule a save to localStorage (debounced by `throttleMs`)
- On `loaded-metadata`, read saved time and set `mediaPlayer.currentTime`
- On `ended`, clear localStorage so a re-watched video starts from the beginning
- Storage is keyed by full source URL — same video on different pages resumes from the same point

## No analytics, no PII

Position is just a number; nothing identifying. Per-browser, per-video.

## Events

None.
