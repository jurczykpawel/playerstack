# @playerstack/plugin-sources

Auto-detects YouTube, Vimeo, MP4, HLS, WebM, and DASH from a single `src` URL, validates it, and lets the core element pick the right inner media element (native `<video>`, `<youtube-video>`, `<vimeo-video>`, or `<hls-video>`). Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

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
<player-stack src="https://example.com/video.mp4"></player-stack>
<player-stack src="https://example.com/playlist.m3u8"></player-stack>
```

## Supported formats

| Format  | URL patterns                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| YouTube | `youtu.be/ID`, `youtube.com/watch?v=ID`, `youtube.com/embed/ID`, `youtube.com/shorts/ID`, `youtube.com/v/ID`, `m.youtube.com/...`, `youtube-nocookie.com/...` |
| Vimeo   | `vimeo.com/ID`, `vimeo.com/ID/HASH` (private), `player.vimeo.com/video/ID`                                                                                    |
| MP4     | any `https://...*.mp4`                                                                                                                                        |
| HLS     | any `https://...*.m3u8`                                                                                                                                       |
| WebM    | any `https://...*.webm`                                                                                                                                       |
| DASH    | any `https://...*.mpd`                                                                                                                                        |

Extension matching is case-insensitive. Non-https schemes are rejected. Unknown formats produce a clear error.

## Programmatic resolver

You can also use the parser without the plugin:

```ts
import { resolveSource } from "@playerstack/plugin-sources";

const result = resolveSource("https://youtu.be/dQw4w9WgXcQ");
// { type: "youtube", id: "dQw4w9WgXcQ" }
```

## License

MIT.
