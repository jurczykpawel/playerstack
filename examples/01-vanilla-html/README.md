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
2. Registers all 5 MVP plugins (sources, controls-policy, autopreview, branded-thumb, cta-end)

When the browser parses the `<player-stack>` element, the `sources` plugin recognizes the YouTube URL and rewrites it into Vidstack's format. Vidstack mounts inside the element with its default UI.

## Try

- Replace the `src` with a Vimeo URL: `https://vimeo.com/123456789`
- Replace with an MP4: `https://files.vidstack.io/sprite-fight/720p.mp4`
- Replace with HLS: `https://example.com/stream.m3u8`
