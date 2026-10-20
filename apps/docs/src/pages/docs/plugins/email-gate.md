---
layout: ../../../layouts/Docs.astro
title: email-gate — Playerstack
description: Lead capture overlay with secure-by-default Altcha proof-of-work + single-use nonce verification.
---

# email-gate

> Package: `@playerstack/plugin-email-gate` ([source](https://github.com/jurczykpawel/playerstack/tree/main/packages/plugin-email-gate)), not published to npm yet

Pause the video and show an email form before the visitor can keep watching. Lead capture for course previews, lead magnets, and pre-roll qualifying.

**Secure-by-default:** if you set `webhookUrl`, you must also set `challengeUrl`. The plugin refuses to render otherwise — this prevents accidentally exposing an unauthenticated lead-capture endpoint that any bot can scrape from DevTools and flood. See [Email lead capture security](/docs/security/email-leads) for the full server protocol with examples for Next.js, Hono, and Cloudflare Workers.

## Quickstart — open mode (event bus only)

For local dev, internal tools, or when you handle the lead inside the page:

```html
<player-stack
  src="https://files.example.com/lesson.mp4"
  data-config='{
    "emailGate": {
      "enabled": true,
      "at": "before",
      "title": "Drop your email to watch the full lesson",
      "buttonLabel": "Unlock video →"
    }
  }'
></player-stack>
```

The form pauses the video and emits `email-gate:submit` on the event bus. **Nothing is POSTed anywhere** — your code listens via a custom plugin if needed.

## Quickstart — hardened mode (recommended for any public deployment)

```html
<player-stack
  src="https://files.example.com/lesson.mp4"
  data-config='{
    "emailGate": {
      "enabled": true,
      "at": "before",
      "webhookUrl":   "https://your-api.com/api/leads",
      "challengeUrl": "https://your-api.com/api/leads/challenge"
    }
  }'
></player-stack>
```

Both URLs required. Server protocol + full code examples: [Email lead capture security](/docs/security/email-leads).

## Config

| Field          | Type                 | Default                    | Description                                                                       |
| -------------- | -------------------- | -------------------------- | --------------------------------------------------------------------------------- |
| `enabled`      | `boolean`            | `false`                    | Plugin is a no-op unless `true`                                                   |
| `at`           | `"before" \| number` | `"before"`                 | Show on init, or after N seconds of playback                                      |
| `atPercent`    | `number`             | —                          | Alternative trigger at N% of duration                                             |
| `webhookUrl`   | `string`             | —                          | Where to POST `LeadsSubmission`. **Requires `challengeUrl`.**                     |
| `challengeUrl` | `string`             | —                          | Where to GET `LeadsChallenge`. Server issues Altcha challenge + single-use nonce. |
| `title`        | `string`             | `"Watch the rest"`         | Heading text                                                                      |
| `buttonLabel`  | `string`             | `"Continue watching →"`    | Submit button label                                                               |
| `storageKey`   | `string`             | `"playerstack:email-gate"` | localStorage key prefix                                                           |

## Events

| Name                | Payload             | When                                                                                |
| ------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `email-gate:submit` | `{ email: string }` | Server accepted the submission (or open-mode form was filled, honeypot not tripped) |

## Built-in client-side protections

- **Honeypot field** — invisible `name="website"` input. Filled = silent drop, no event, no fetch.
- **`localStorage` memo** — successful submission stores a timestamp keyed on `src`. Same browser doesn't see the gate twice.
- **Refuse-on-misconfig** — `webhookUrl` without `challengeUrl` logs an error and renders nothing.

## Use cases

- **Course previews** — gate the second half of a free preview lesson
- **Lead magnets** — gate the entire video until email is captured
- **Pre-roll qualifying** — qualify viewers before showing the pitch
