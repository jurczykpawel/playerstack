# 03 — GDPR click-to-load

Privacy-first YouTube embed. The YouTube iframe (and all its tracking cookies) doesn't load until the user actually clicks play.

## Run

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Verify it works

1. Open the page in an incognito window (no existing cookies)
2. Open DevTools → **Application** → **Cookies** — should be empty for `youtube.com`
3. Open DevTools → **Network** — clear the log
4. Reload the page **without clicking**
5. Filter network for `youtube.com` and `googlevideo.com` — should be **zero requests**
6. Click the player → suddenly you'll see the iframe load with all the usual tracking

## Why

Several EU regulators have fined sites that embed YouTube directly without consent:

- French CNIL (2022): Google Analytics + embedded YT trackers ruled illegal under GDPR
- Italian Garante (2022): same
- Multiple ongoing cases across EU

A consent banner asking "load YouTube?" works but is friction. Click-to-load is the user-friendly alternative — the user implicitly consents by clicking the play button on the poster.

## Config used

```json
{
  "brandedThumb": {
    "enabled": true,
    "clickToLoad": true,
    "playButtonStyle": "circle"
  }
}
```

## Caveats

- The `poster` URL still loads on page load (it's an image, not a tracker)
- If you want zero requests to YouTube infrastructure, host the poster yourself
- Once the user clicks, normal YouTube behavior applies — that's expected
