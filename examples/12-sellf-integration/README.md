# 12 — Sellf integration

Drive player config from a [Sellf](https://sellf.app) product endpoint. Edit the video, poster, CTA in Sellf admin → embeds across your sites update on next page load.

## How it works

```
                ┌─────────────────────────────────┐
   Browser  ────│  <player-stack                  │
                │     data-sellf-product="abc">   │
                │  </player-stack>                │
                └────────────┬────────────────────┘
                             │ on connect
                             ▼
              SellfConfigProvider.load(element)
                             │
                             ▼
   GET https://sellf.app/api/products/abc/playerstack
                             │
                             ▼
   { src: "...", poster: "...", ctaEnd: {...} }
                             │
                             ▼
         core picks the inner media element + plugins consume this config
```

## Endpoint contract

Your Sellf product must serve `/api/products/:id/playerstack` returning JSON:

```json
{
  "src": "https://files.example.com/lessons/intro.mp4",
  "poster": "https://cdn.example.com/posters/intro.webp",
  "title": "Lesson 1: Introduction",
  "controls": { "accent": "#008aff" },
  "brandedThumb": { "enabled": true, "clickToLoad": true },
  "ctaEnd": {
    "enabled": true,
    "title": "Loved it? Get the full course.",
    "button": {
      "label": "Enroll now",
      "url": "https://sellf.app/buy/abc",
      "utm": "utm_source=preview"
    },
    "showReplay": true
  }
}
```

`src` is required. Anything else is optional.

## Run

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

> Note: this example assumes a Sellf endpoint exists. The fetch will 404 against real `sellf.app` unless you have a configured product. The demo is for showing the integration pattern.

## Use case: course platform

You sell N courses on Sellf. Each has its own product page on your marketing site:

```html
<!-- /courses/intro/page.html -->
<player-stack data-sellf-product="course-intro"></player-stack>

<!-- /courses/advanced/page.html -->
<player-stack data-sellf-product="course-advanced"></player-stack>
```

Both pages embed the same player code. Sellf is the source of truth — change the video in admin, every embed updates.

## Inline overrides

Per-page overrides win on merge:

```html
<player-stack
  data-sellf-product="course-intro"
  title="Special preview for newsletter subscribers"
></player-stack>
```

Sellf still drives `src`, `poster`, `ctaEnd`, etc. but `title` is taken from the attribute.

## Auth

If your endpoint requires auth (e.g. only logged-in users see private courses):

```js
const sellf = createSellfConfigProvider({
  baseUrl: "https://sellf.app",
  fetchOptions: { credentials: "include" }, // sends Sellf session cookies
});
```

For token-based auth:

```js
const sellf = createSellfConfigProvider({
  baseUrl: "https://sellf.app",
  fetchOptions: {
    headers: { Authorization: `Bearer ${getToken()}` },
  },
});
```
