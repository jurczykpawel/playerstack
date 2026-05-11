# 01 — Vanilla HTML

The simplest possible Playerstack embed. No build step, no framework, no JavaScript.

## Run

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## What's happening

```html
<script
  src="https://cdn.jsdelivr.net/npm/playerstack@0.1.0/dist/playerstack.min.js"
  defer
></script>

<player-stack
  src="https://youtu.be/_cMxraX_5RE"
  title="Sprite Fight"
></player-stack>
```

The `<script>` tag loads the standalone bundle, which:

1. Registers the `<player-stack>` custom element
2. Registers all 13 plugins (sources, controls-policy, autopreview, branded-thumb, cta-end, chapters, action-bar, email-gate, saved-position, sticky, focus-mode, analytics, yt-subscribe)

When the browser parses the `<player-stack>` element, the `sources` plugin validates the URL, the core element picks `<youtube-video>` as the inner media element, and `<media-controller>` mounts a default UI around it.

## Try

- Replace the `src` with a Vimeo URL: `https://vimeo.com/123456789`
- Replace with an MP4: `https://media.w3.org/2010/05/sintel/trailer.mp4`
- Replace with HLS: `https://example.com/stream.m3u8`
