---
layout: ../../../layouts/Docs.astro
title: email-gate — Playerstack
description: Lead capture overlay with secure-by-default Altcha proof-of-work + single-use nonce verification.
---

# email-gate

An email form before, during, or after a video. In open mode it emits an event without network requests. Hardened mode obtains an ALTCHA challenge and a server-issued nonce for each submission attempt, then sends the completed form to your endpoint.

Part of [Playerstack](https://github.com/jurczykpawel/playerstack). The standalone script loads the plugin on demand. The `@playerstack/*` packages are not published to npm yet.

## After-video form

```html
<script
  src="https://playerstack.techskills.academy/playerstack.min.js"
  defer
></script>
<player-stack
  src="https://files.example.com/demo.mp4"
  data-config='{
    "emailGate": {
      "enabled": true,
      "at": "after",
      "product": "Selfware",
      "webhookUrl": "https://your-api.com/leads",
      "challengeUrl": "https://your-api.com/challenge?brand=selfware",
      "altchaFormat": "base64",
      "rememberDays": 30,
      "dismissible": true,
      "privacy": {
        "text": "Zostaw maila, a odezwę się w sprawie podobnego rozwiązania.",
        "linkText": "Informacja o prywatności",
        "href": "/privacy/"
      },
      "messages": {
        "title": "Chcesz coś takiego u siebie? Zostaw maila",
        "emailLabel": "Adres email",
        "placeholder": "Ty@example.pl",
        "submit": "Wyślij",
        "verifying": "Sprawdzam zgłoszenie…",
        "solving": "Trwa weryfikacja…",
        "submitting": "Wysyłam…",
        "success": "Dziękuję. Zgłoszenie zostało wysłane.",
        "invalidEmail": "Wpisz poprawny adres email.",
        "rejected": "Zgłoszenie odrzucono. Spróbuj ponownie.",
        "rateLimit": "Za dużo prób. Spróbuj później.",
        "networkError": "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.",
        "dismiss": "Pomiń"
      }
    }
  }'
></player-stack>
```

`after` waits for `ended`, independently of `atPercent`. Success or dismissal leaves playback completed. Other triggers pause playback and resume it on success or dismissal. The form appears once per player initialization. Dismissal never writes a memo.

For open mode, omit **both** endpoint URLs. For a pre-roll gate use `at: "before"`; for a mid-roll gate use `at: 30` (seconds) or `atPercent: 50` without `at`. Setting `webhookUrl` without `challengeUrl`, or configuring either with a non-HTTP(S) URL, disables the plugin.

## Config

| Field          | Type                                                 | Default                               | Description                                                                                                                                                                       |
| -------------- | ---------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`      | `boolean`                                            | `false`                               | Enable the plugin.                                                                                                                                                                |
| `at`           | `"before" \| "after" \| number`                      | `"before"` unless `atPercent` is set  | Initialization, `ended`, or elapsed seconds.                                                                                                                                      |
| `atPercent`    | `number`                                             | —                                     | Threshold percentage of a known duration. With numeric `at`, either threshold triggers the gate; explicit `before`/`after` takes precedence.                                      |
| `webhookUrl`   | `string`                                             | —                                     | Absolute HTTP(S) submission endpoint; requires `challengeUrl`.                                                                                                                    |
| `challengeUrl` | `string`                                             | —                                     | Absolute HTTP(S) challenge endpoint; requires `webhookUrl`.                                                                                                                       |
| `altchaFormat` | `"object" \| "base64"`                               | `"object"`                            | Format of the POST `altcha` field. Mailstack/Selfware uses `base64`.                                                                                                              |
| `product`      | `string`                                             | —                                     | Separate product identifier, 1–100 characters. Empty, whitespace-only, or longer values disable the plugin with `console.warn`.                                                   |
| `privacy`      | `{ text: string; linkText?: string; href?: string }` | —                                     | Text below the email input, connected with `aria-describedby`. Text is rendered literally. A link requires text and an HTTP(S) or relative URL; uses `rel="noopener noreferrer"`. |
| `dismissible`  | `boolean`                                            | `true` for `after`, otherwise `false` | Show a dismissal button and allow Escape within the overlay.                                                                                                                      |
| `messages`     | `Partial<EmailGateMessages>`                         | English (table below)                 | Override any viewer-facing message, including accessible input label and live status.                                                                                             |
| `title`        | `string`                                             | `"Watch the rest"`                    | Legacy heading override; `messages.title` takes precedence.                                                                                                                       |
| `buttonLabel`  | `string`                                             | `"Continue watching →"`               | Legacy submit override; `messages.submit` takes precedence.                                                                                                                       |
| `storageKey`   | `string`                                             | `"playerstack:email-gate"`            | Memo prefix; the full key is `<prefix>:<src>`.                                                                                                                                    |
| `remember`     | `boolean`                                            | `true`                                | Store a timestamp after success; `false` performs no storage reads or writes.                                                                                                     |
| `rememberDays` | `number`                                             | No expiry                             | Lifetime in days measured from successful submission. Expired entries are deleted on initialization. Use a finite non-negative value.                                             |

Storage errors do not prevent the form or playback. Existing timestamp memos remain compatible; without `rememberDays`, existing nonempty memos do not expire. No email or product is stored in the memo. Hosts supply privacy wording and retention appropriate to their service.

### Messages

The input has an accessible label. Validation and progress are announced in a polite `role="status"` region. On success the overlay is removed and the success region remains until the player is destroyed.

| Key            | English default                                |
| -------------- | ---------------------------------------------- |
| `title`        | Watch the rest                                 |
| `emailLabel`   | Email address                                  |
| `placeholder`  | you@example.com                                |
| `submit`       | Continue watching →                            |
| `verifying`    | Verifying…                                     |
| `solving`      | Solving challenge…                             |
| `submitting`   | Submitting…                                    |
| `success`      | Thank you. Your email was received.            |
| `invalidEmail` | Please enter a valid email address.            |
| `rejected`     | Submission rejected. Please retry.             |
| `rateLimit`    | Too many requests. Please try again later.     |
| `networkError` | Could not complete verification. Please retry. |
| `dismiss`      | Skip                                           |

## Hardened mode contract

The public types `EmailGateConfig`, `EmailGateMessages`, `LeadsChallenge`, and `LeadsSubmission` are exported from `@playerstack/plugin-email-gate`.

### 1. GET challenge

Every submission attempt starts with `GET <challengeUrl>`, with credentials included and `Accept: application/json`. If `product` is configured, the plugin sets a URL-encoded `product` query parameter, preserving other query parameters. The host configures the brand in `challengeUrl`.

Example: `GET https://your-api.com/challenge?brand=selfware&product=Selfware`

The JSON response has `nonce` at the top level, next to `altcha`:

```json
{
  "altcha": {
    "algorithm": "SHA-256",
    "challenge": "challenge-digest",
    "maxnumber": 100000,
    "salt": "server-salt",
    "signature": "server-signature"
  },
  "nonce": "server-issued-one-time-value"
}
```

`algorithm` supports `SHA-1`, `SHA-256`, and `SHA-512`. `maxnumber` is optional. A flat challenge, missing nonce, or malformed response produces the network-error message and no POST.

The server associates the nonce with the product and a TTL (Mailstack: approximately ten minutes). The first POST carrying a nonce consumes it atomically, **regardless of result**, including invalid ALTCHA, email, product, or a 4xx/5xx response. The server validates the requested product against the brand allowlist and the nonce-bound product. Nonce consumption must precede validation paths returning an error.

The plugin never retains a challenge for another attempt. Every retry fetches a new challenge and nonce; there is no automatic POST retry. Server code must also enforce nonce lifetime and single use.

### 2. POST submission

`POST <webhookUrl>` includes credentials and `Content-Type: application/json`. `product` is omitted when not configured; it is independent of the video `src`.

Default `altchaFormat: "object"` (compatible with existing clients):

```json
{
  "email": "viewer@example.com",
  "src": "https://files.example.com/demo.mp4",
  "product": "Selfware",
  "nonce": "server-issued-one-time-value",
  "altcha": {
    "algorithm": "SHA-256",
    "challenge": "challenge-digest",
    "number": 7,
    "salt": "server-salt",
    "signature": "server-signature"
  }
}
```

For `altchaFormat: "base64"`, the same POST has a string `altcha` field containing standard base64 of the UTF-8 JSON payload `{ algorithm, challenge, number, salt, signature }`. For example, this is a complete serialized POST using illustrative short values:

```json
{
  "email": "viewer@example.com",
  "src": "https://files.example.com/demo.mp4",
  "product": "Selfware",
  "nonce": "server-issued-one-time-value",
  "altcha": "eyJhbGdvcml0aG0iOiJTSEEtMjU2IiwiY2hhbGxlbmdlIjoiYyIsIm51bWJlciI6Nywic2FsdCI6InMiLCJzaWduYXR1cmUiOiJzaWcifQ=="
}
```

The server must support the selected format. These example values illustrate shape, not a valid proof. The form also includes an off-screen `website` field; filled submissions are dropped locally without a POST, event, or memo.

| Response                                                           | Client result                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Any 2xx from POST                                                  | Emit submit, store memo if enabled, remove overlay, announce success. No response body required. |
| 429                                                                | `messages.rateLimit`; re-enable submit.                                                          |
| Other 4xx                                                          | `messages.rejected`; re-enable submit.                                                           |
| 5xx, transport/JSON error, malformed challenge, or failed solution | `messages.networkError`; re-enable submit.                                                       |

Every failure keeps the form available for retry with a fresh challenge and nonce. Closing or destroying the form while a request is pending prevents later client success or further POSTs; an already-sent POST may still be processed by the server.

## Events

| Name                 | Payload                               | When                                                                             |
| -------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| `email-gate:submit`  | `{ email: string; product?: string }` | POST accepted, or valid open-mode submission. Product omitted if not configured. |
| `email-gate:dismiss` | `{}`                                  | Dismissal button or Escape when dismissible; no memo.                            |

## License

Apache-2.0.
