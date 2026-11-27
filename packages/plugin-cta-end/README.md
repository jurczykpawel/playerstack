# @playerstack/plugin-cta-end

Overlay with optional title, custom HTML, anchor button (label + URL + UTM), and replay — shown when the video ends, at the start or at a set time. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://playerstack.techskills.academy/playerstack.min.js) bundle.

## Install

This plugin is included in the standalone script, so there is nothing to install:

```html
<script
  src="https://playerstack.techskills.academy/playerstack.min.js"
  defer
></script>
```

The `@playerstack/*` packages are not published to npm yet; to compose your own bundle, build it from this repository.

## Use

```ts
import { Playerstack } from "@playerstack/core";
import { ctaEndPlugin } from "@playerstack/plugin-cta-end";

Playerstack.use(ctaEndPlugin).define();
```

```html
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{
    "ctaEnd": {
      "enabled": true,
      "title": "Want the deep dive?",
      "button": {
        "label": "Get the course",
        "url": "https://example.com/course",
        "utm": "utm_source=playerstack&utm_medium=video"
      },
      "showReplay": true
    }
  }'
>
</player-stack>
```

## When the card appears

By default the card appears when the video ends. Despite the package name, it can also appear at the start or during playback:

| Setting           | The card appears                                                           |
| ----------------- | -------------------------------------------------------------------------- |
| none, `at: "end"` | When the video ends                                                        |
| `at: "start"`     | When playback starts from the beginning (within the first 2 seconds)       |
| `at: 90`          | When playback reaches second 90                                            |
| `atPercent: 50`   | When playback reaches half of the duration (ignored when `at` is also set) |

`"start"` and timed cards pause the video, hold it paused while the card is open (also if the email gate or the page calls `play()`), and add a skip button; skip and `Escape` close the card and resume playback.

- **Seeking and resuming.** A timed card appears as soon as the position is at or past the point, however it got there: normal playback, a seek, or a position restored by [saved-position](https://playerstack.techskills.academy/docs/plugins/saved-position). Seeking back does not repeat it.
- **Start card and saved position.** When playback begins further in than 2 seconds (a restored position, a deep link), the start card is dropped for that playback, so it never interrupts the middle of the video.
- **Autoplay preview.** While `preview.enabled` plays the main video muted (no `preview.src`), start and timed cards wait; they apply once the viewer unmutes or starts the video with sound.
- **Email gate.** The gate sits above the card. When both are due at once, the viewer passes the gate first and then sees the card, with the video still paused.
- **Frequency.** `"playback"` (default for start and timed cards) shows the card once per loaded source. `"session"` shows it once per browser tab session for the same `src` (`sessionStorage`; without storage it behaves like `"playback"`). End cards appear on every `ended` unless `frequency` is set.

The standalone script downloads `playerstack-cta-end-timed.js` only when `at`, `atPercent` or `frequency` is set. If that download fails, the error is logged and no card is shown; playback continues.

```json
{
  "ctaEnd": {
    "enabled": true,
    "at": 90,
    "frequency": "session",
    "title": "Halfway there",
    "button": {
      "label": "Get the course",
      "url": "https://example.com/course"
    },
    "skipLabel": "Keep watching"
  }
}
```

## Config

`config.ctaEnd`:

| Field          | Type                        | Description                                                                |
| -------------- | --------------------------- | -------------------------------------------------------------------------- |
| `enabled`      | `boolean`                   | Plugin is a no-op unless `true`                                            |
| `title`        | `string?`                   | Heading text inside the overlay                                            |
| `html`         | `string?`                   | HTML filtered through core sanitizeHtml before rendering (see rules below) |
| `button.label` | `string`                    | Visible text                                                               |
| `button.url`   | `string`                    | Destination URL                                                            |
| `button.utm`   | `string?`                   | Query string appended to URL (e.g. `utm_source=...`)                       |
| `showReplay`   | `boolean?`                  | Render a "Replay" button that re-plays the video and dismisses the overlay |
| `at`           | "start" \| "end" \| number? | When to show the card (see above); a number is seconds. Default `"end"`    |
| `atPercent`    | number?                     | Show at this percent (0-100) of the duration; ignored when `at` is set     |
| `frequency`    | "playback" \| "session"?    | How often the card may appear                                              |
| `skipLabel`    | string?                     | Skip button text on start and timed cards (default `"Skip"`)               |
| `replayLabel`  | `string?`                   | Replay button text (default `"Replay"`); set it in the page language       |

## Events

| Name         | Payload                          | When                                                                |
| ------------ | -------------------------------- | ------------------------------------------------------------------- |
| `cta:show`   | `{ at }` or `{ atPercent }`      | The card appears; only when `at`, `atPercent` or `frequency` is set |
| `cta:skip`   | `{ at }` or `{ atPercent }`      | The viewer skips a start or timed card                              |
| `cta:click`  | `{ label: string, url: string }` | User clicks the CTA button                                          |
| `cta:replay` | `undefined`                      | User clicks the replay button                                       |

[analytics](https://playerstack.techskills.academy/docs/plugins/analytics) forwards all four by default. To count plain end cards too, set `at: "end"`.

Hook these to your analytics:

```ts
ctx.events.on("cta:click", ({ label, url }) => {
  navigator.sendBeacon(
    "/api/track",
    JSON.stringify({ event: "cta_click", label, url }),
  );
});
```

## HTML rendering rules

`html` passes through core's [sanitizeHtml](https://github.com/jurczykpawel/playerstack/blob/main/packages/core/src/safe-html.ts) before the resulting fragment is assigned to `innerHTML`.

- Allowed elements: `a`, `b`, `br`, `code`, `em`, `h3`–`h6`, `i`, `li`, `ol`, `p`, `small`, `span`, `strong`, `sub`, `sup`, `u`, and `ul`.
- Allowed attributes on those elements: `class`, `data-*`, `aria-*`, and `role`; anchors may also have `href`. Event attributes (`on*`), `style`, `id`, and other attributes are removed.
- Anchor `href` must parse as an absolute HTTP(S) URL. Other values, including relative URLs and fragments, lose `href`. Anchors with an accepted `href` get `target="_blank"` and `rel="noopener noreferrer"`.
- The walk removes comments. When it encounters a disallowed element, `script`, `style`, `iframe`, `noscript`, `object`, and `embed` are removed with their contents; other disallowed elements are replaced by a plain text node containing their `textContent`.

This is a browser DOM-based rendering allowlist; without `document`, the helper returns an empty string. URL host policy and server-side validation remain the integrator's responsibility.

## Styling

The overlay uses CSS variables you can override globally:

- `--ps-accent` — button background color
- `--ps-bg-opacity` — overlay backdrop opacity (also see `@playerstack/plugin-controls-policy`)

## License

Apache-2.0.

## Keyboard access

End cards are bounded by the player height and scroll inside their own overlay when content is too tall. Content stays centered when it fits and begins at the top when it overflows. Keyboard focus and pointer/touch scrolling do not move the player content.

After ended, covered controls are inert and hidden from assistive technology. Focus enters the CTA only if the player owned focus (including body focus after player interaction). Tab and Shift+Tab can leave the player. Replay seeks to zero, restores the controls, starts playback and focuses play, falling back to the controller.
