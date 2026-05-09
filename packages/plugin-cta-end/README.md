# @playerstack/plugin-cta-end

Overlay with optional title, custom HTML, anchor button (label + URL + UTM), and replay — shown when the video ends. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-cta-end
```

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
  }'>
</player-stack>
```

## Config

`config.ctaEnd`:

| Field | Type | Description |
|---|---|---|
| `enabled` | `boolean` | Plugin is a no-op unless `true` |
| `title` | `string?` | Heading text inside the overlay |
| `html` | `string?` | Custom HTML rendered inside the overlay (use carefully — innerHTML, no sanitization) |
| `button.label` | `string` | Visible text |
| `button.url` | `string` | Destination URL |
| `button.utm` | `string?` | Query string appended to URL (e.g. `utm_source=...`) |
| `showReplay` | `boolean?` | Render a "Replay" button that re-plays the video and dismisses the overlay |

## Events

| Name | Payload | When |
|---|---|---|
| `cta:click` | `{ label: string, url: string }` | User clicks the CTA button |
| `cta:replay` | `undefined` | User clicks the replay button |

Hook these to your analytics:

```ts
ctx.events.on("cta:click", ({ label, url }) => {
  navigator.sendBeacon("/api/track", JSON.stringify({ event: "cta_click", label, url }));
});
```

## Styling

The overlay uses CSS variables you can override globally:

- `--ps-accent` — button background color
- `--ps-bg-opacity` — overlay backdrop opacity (also see `@playerstack/plugin-controls-policy`)

## License

MIT.
