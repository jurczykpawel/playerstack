# @playerstack/plugin-sources

Auto-detects YouTube, Vimeo, Wistia, Twitch, Bunny Stream, MP4, HLS, WebM, and DASH from a single `src` URL, validates it, and lets the core element pick the right inner media element (`<video>`, `<youtube-video>`, `<vimeo-video>`, `<wistia-video>`, `<twitch-video>`, or `<hls-video>`). Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

The standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle includes this plugin by default — install this package directly only if you're using `@playerstack/core` and composing your own bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-sources
```

## Use

```ts
import { Playerstack } from "@playerstack/core";
import { sourcesPlugin } from "@playerstack/plugin-sources";

Playerstack.use(sourcesPlugin).define();
```

Now any of these work without per-source configuration:

```html
<player-stack src="https://youtu.be/dQw4w9WgXcQ"></player-stack>
<player-stack src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></player-stack>
<player-stack src="https://vimeo.com/123456789"></player-stack>
<player-stack
  src="https://wesleyluyten.wistia.com/medias/oifkgmxnkb"
></player-stack>
<player-stack src="https://www.twitch.tv/videos/106400740"></player-stack>
<player-stack
  src="https://vz-abc.b-cdn.net/library/playlist.m3u8"
></player-stack>
<player-stack src="https://example.com/video.mp4"></player-stack>
<player-stack src="https://example.com/playlist.m3u8"></player-stack>
```

## Supported formats

| Format  | URL patterns                                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| YouTube | `youtu.be/ID`, `youtube.com/watch?v=ID`, `youtube.com/embed/ID`, `youtube.com/shorts/ID`, `youtube.com/v/ID`, `m.youtube.com/...`, `youtube-nocookie.com/...`  |
| Vimeo   | `vimeo.com/ID`, `vimeo.com/ID/HASH` (private), `player.vimeo.com/video/ID`                                                                                     |
| Wistia  | `{account}.wistia.com/medias/ID`, `fast.wistia.com/embed/iframe/ID`, `fast.wistia.com/embed/medias/ID`, `wi.st/medias/ID`                                      |
| Twitch  | `twitch.tv/videos/ID` (VOD), `twitch.tv/{channel}` (live), `clips.twitch.tv/{slug}`, `twitch.tv/{channel}/clip/{slug}`, `player.twitch.tv/?video=…\|channel=…` |
| Bunny   | `*.b-cdn.net/*.m3u8` (Stream HLS), `*.b-cdn.net/*.mp4` (direct files); `iframe.mediadelivery.net/embed/...` is rejected — use the HLS URL                      |
| MP4     | any `https://...*.mp4`                                                                                                                                         |
| HLS     | any `https://...*.m3u8`                                                                                                                                        |
| WebM    | any `https://...*.webm`                                                                                                                                        |
| DASH    | any `https://...*.mpd`                                                                                                                                         |

Extension matching is case-insensitive. Non-https schemes are rejected. Unknown formats produce a clear error.

### Twitch — required `parent` config

Twitch's embed iframe requires every domain that hosts it to be listed in a `parent` parameter (CORS-style allowlist). Set it on `config.twitch.parent`:

```html
<player-stack
  src="https://www.twitch.tv/videos/106400740"
  data-config='{"twitch": {"parent": "example.com"}}'
></player-stack>
```

Multiple parent domains:

```json
{ "twitch": { "parent": ["example.com", "app.example.com"] } }
```

Without `parent`, Twitch will refuse to render. Localhost works during development without configuration thanks to the wrapper's defaults.

## Programmatic resolver

You can also use the parser without the plugin:

```ts
import { resolveSource } from "@playerstack/plugin-sources";

const result = resolveSource("https://youtu.be/dQw4w9WgXcQ");
// { type: "youtube", id: "dQw4w9WgXcQ" }
```

## License

Apache-2.0.
