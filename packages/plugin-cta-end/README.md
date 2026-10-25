# @playerstack/plugin-cta-end

Overlay with optional title, custom HTML, anchor button (label + URL + UTM), and replay — shown when the video ends. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

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

## Config

`config.ctaEnd`:

| Field          | Type       | Description                                                                          |
| -------------- | ---------- | ------------------------------------------------------------------------------------ |
| `enabled`      | `boolean`  | Plugin is a no-op unless `true`                                                      |
| `title`        | `string?`  | Heading text inside the overlay                                                      |
| `html`         | `string?`  | Custom HTML rendered inside the overlay (use carefully — innerHTML, no sanitization) |
| `button.label` | `string`   | Visible text                                                                         |
| `button.url`   | `string`   | Destination URL                                                                      |
| `button.utm`   | `string?`  | Query string appended to URL (e.g. `utm_source=...`)                                 |
| `showReplay`   | `boolean?` | Render a "Replay" button that re-plays the video and dismisses the overlay           |
| `replayLabel`  | `string?`  | Replay button text (default `"Replay"`); set it in the page language                 |

## Events

| Name         | Payload                          | When                          |
| ------------ | -------------------------------- | ----------------------------- |
| `cta:click`  | `{ label: string, url: string }` | User clicks the CTA button    |
| `cta:replay` | `undefined`                      | User clicks the replay button |

Hook these to your analytics:

```ts
ctx.events.on("cta:click", ({ label, url }) => {
  navigator.sendBeacon(
    "/api/track",
    JSON.stringify({ event: "cta_click", label, url }),
  );
});
```

## Styling

The overlay uses CSS variables you can override globally:

- `--ps-accent` — button background color
- `--ps-bg-opacity` — overlay backdrop opacity (also see `@playerstack/plugin-controls-policy`)

## License

Apache-2.0.

## Keyboard access

After ended, covered controls are inert and hidden from assistive technology. Focus enters the CTA only if the player owned focus (including body focus after player interaction). Tab and Shift+Tab can leave the player. Replay seeks to zero, restores the controls, starts playback and focuses play, falling back to the controller.
