---
layout: ../../../layouts/Docs.astro
title: email-gate — Playerstack
description: Lead capture overlay that pauses the video until the visitor submits an email.
---

# email-gate

> npm: [`@playerstack/plugin-email-gate`](https://www.npmjs.com/package/@playerstack/plugin-email-gate)

Pause the video and show an email form before the visitor can keep watching. Submission is remembered in `localStorage` so the same browser doesn't see the gate twice. The KEY marketing feature for course previews and lead magnets.

## Quickstart

```html
<player-stack
  src="https://files.example.com/lesson-preview.mp4"
  data-config='{
    "emailGate": {
      "enabled": true,
      "at": "before",
      "title": "Drop your email to watch the full lesson",
      "buttonLabel": "Unlock video →",
      "webhookUrl": "https://example.com/api/leads"
    }
  }'
>
</player-stack>
```

## Config

`config.emailGate`:

| Field         | Type                 | Default                    | Description                                                             |
| ------------- | -------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `enabled`     | boolean              | `false`                    | Plugin is a no-op unless `true`                                         |
| `at`          | `"before" \| number` | `"before"`                 | `"before"` shows on init. Number ≤ 100 = % of duration, > 100 = seconds |
| `title`       | string?              | `"Watch the rest"`         | Heading text inside the form                                            |
| `buttonLabel` | string?              | `"Continue watching →"`    | Submit button label                                                     |
| `webhookUrl`  | string?              | none                       | If set, POST `{ email, src }` JSON on submit                            |
| `storageKey`  | string?              | `"playerstack:email-gate"` | localStorage key prefix; full key = `${prefix}:${src}`                  |

## Events

| Name                | Payload     | When                     |
| ------------------- | ----------- | ------------------------ |
| `email-gate:submit` | `{ email }` | User submits valid email |

## Use cases

- **Course previews** — gate the second half of a free preview lesson
- **Lead magnets** — gate the entire video until email is captured
- **Pre-roll qualifying** — qualify viewers before showing the pitch

## Integrating with your CRM

Use `webhookUrl` for server-to-server, or listen on the event bus and call your provider's JS SDK:

```ts
ctx.events.on("email-gate:submit", ({ email }) => {
  // Listmonk, Mailchimp, ConvertKit, etc.
  fetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, list: "course-leads" }),
  });
});
```
