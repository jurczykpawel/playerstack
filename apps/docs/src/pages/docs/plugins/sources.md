---
layout: ../../../layouts/Docs.astro
title: sources — Playerstack
description: Auto-detect YouTube, Vimeo, MP4, HLS, WebM, DASH from a single src URL.
---

# sources

> Package: `@playerstack/plugin-sources` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-sources)), not published to npm yet

Auto-detects the source type from a single `src` URL, validates it, and lets the core element pick the right inner media element (native `<video>` for MP4/WebM, `<youtube-video>`, `<vimeo-video>`, or `<hls-video>`). Paste any URL — it just works.

## Quickstart

```html
<player-stack src="https://youtu.be/dQw4w9WgXcQ"></player-stack>
<player-stack src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></player-stack>
<player-stack src="https://vimeo.com/123456789"></player-stack>
<player-stack src="https://example.com/video.mp4"></player-stack>
<player-stack src="https://example.com/playlist.m3u8"></player-stack>
```

## Supported formats

| Format  | URL patterns                                                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| YouTube | `youtu.be/ID`, `youtube.com/watch?v=ID`, `/embed/ID`, `/shorts/ID`, `/v/ID`, `m.youtube.com/...`, `youtube-nocookie.com/...` |
| Vimeo   | `vimeo.com/ID`, `vimeo.com/ID/HASH` (private), `player.vimeo.com/video/ID`                                                   |
| MP4     | any `https://...*.mp4`                                                                                                       |
| HLS     | any `https://...*.m3u8`                                                                                                      |
| WebM    | any `https://...*.webm`                                                                                                      |
| DASH    | any `https://...*.mpd`                                                                                                       |

Extension matching is case-insensitive. Non-https schemes are rejected. Unknown formats produce a clear error at init time.

## Config

This plugin reads `config.src`, validates it, and sets it on the inner media element. No additional config slice.

## Programmatic resolver

The parser is exported standalone:

```ts
import { resolveSource } from "@playerstack/plugin-sources";

const result = resolveSource("https://youtu.be/dQw4w9WgXcQ");
// { type: "youtube", id: "dQw4w9WgXcQ" }
```

Useful for server-side rendering where you want to pre-resolve the source type.
