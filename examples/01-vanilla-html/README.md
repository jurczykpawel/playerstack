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
  src="https://playerstack.techskills.academy/playerstack.min.js"
  defer
></script>

<player-stack
  src="https://youtu.be/_cMxraX_5RE"
  title="Sprite Fight"
></player-stack>
```

The `<script>` tag loads the standalone bundle, which:

1. Registers the `<player-stack>` custom element
2. Registers 15 of the 17 first-party plugins (sources, controls-policy, autopreview, branded-thumb, email-gate, saved-position, action-bar, chapters, cta-end, sticky, yt-subscribe, analytics, watermark, custom-css, intro-card). `focus-mode` and `sellf-adapter` require a custom build.

When the browser parses the `<player-stack>` element, the `sources` plugin validates the URL, the core element picks `<youtube-video>` as the inner media element, and `<media-controller>` mounts a default UI around it.

## Try

- Replace the `src` with a Vimeo URL: `https://vimeo.com/123456789`
- Replace with an MP4: `https://media.w3.org/2010/05/sintel/trailer.mp4`
- Replace with HLS: `https://example.com/stream.m3u8`
