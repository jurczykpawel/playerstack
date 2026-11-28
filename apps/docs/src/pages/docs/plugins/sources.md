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

## HLS starting quality

By default hls.js picks the first quality level itself. `config.hls` passes options to hls.js, which loads these streams; the object is read once, when the `<hls-video>` element is created.

```html
<player-stack
  src="https://example.com/playlist.m3u8"
  data-config='{ "hls": { "abrEwmaDefaultEstimate": 1200000 } }'
></player-stack>
```

- `abrEwmaDefaultEstimate` (bits per second) is the assumed bandwidth before the first segment: hls.js starts with a level that fits it, then adapts as usual. About `1200000` starts a typical ladder around 480p.
- `startLevel` selects the first level by index, ordered by bitrate (`0` is the lowest). The resolution behind an index depends on the stream.
- Other [hls.js options](https://github.com/video-dev/hls.js/blob/master/docs/API.md#fine-tuning) with number or boolean values are passed unchanged; options with string or object values (for example `workerPath`, `drmSystems`) are ignored. `capLevelToPlayerSize` limits quality for the whole playback, not only the start.

Browsers that play HLS natively, without hls.js, ignore these options.

## Programmatic resolver

The parser is exported standalone:

```ts
import { resolveSource } from "@playerstack/plugin-sources";

const result = resolveSource("https://youtu.be/dQw4w9WgXcQ");
// { type: "youtube", id: "dQw4w9WgXcQ" }
```

Useful for server-side rendering where you want to pre-resolve the source type.
