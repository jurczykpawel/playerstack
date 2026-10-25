# @playerstack/plugin-email-gate

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
      "marketingConsent": {
        "text": "Chcę otrzymywać wiadomości o nowych materiałach i produktach.",
        "version": "2026-10",
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
        "dismiss": "Pomiń",
        "consentRequired": "Zaznacz zgodę, aby zapisać się na listę."
      }
    }
  }'
></player-stack>
```

`after` waits for `ended`, independently of `atPercent`. Success or dismissal leaves playback completed. Other triggers pause playback and resume it on success or dismissal. The form appears once per player initialization. Dismissal never writes a memo.

For open mode, omit **both** endpoint URLs. For a pre-roll gate use `at: "before"`; for a mid-roll gate use `at: 30` (seconds) or `atPercent: 50` without `at`. Setting `webhookUrl` without `challengeUrl`, or configuring either with a non-HTTP(S) URL, disables the plugin.

## Standalone downloads

Ship the complete output with `scripts/copy-standalone.sh`. The standalone email plugin loads versioned ES module siblings relative to its own script URL:

- `playerstack-email-gate-fields.js`: loaded during initialization only when `privacy`, `marketingConsent`, or `product` is configured. It contains optional field rendering and validation, without the ALTCHA solver.
- `playerstack-email-gate-hardened.js`: loaded on the first valid hardened submission, alongside the challenge GET. It contains challenge validation, the ALTCHA solver, and POST serialization. Open mode never downloads this file, including open forms with optional fields.

Triggers remain active while optional fields download. If their initial download fails, showing the gate retries with a fresh module URL. A repeated failure shows `messages.networkError` and a retry button using `messages.submit`, without an email field or submission; dismissal follows `dismissible`. Retrying restores the complete form only after the fields load.

Both filenames remain stable across releases; the plugin adds a content-version query. Successful downloads are reused. A failed hardened module download displays `messages.networkError` and re-enables submission. Retrying requests a fresh challenge and a fresh module URL. Destroying the player during a download prevents subsequent UI updates and POSTs.

Serve these files with a JavaScript MIME type. For a cross-origin script CDN, allow the embedding page's origin through CORS for the ES modules. The page's script CSP must also permit their URLs. ESM/CJS package consumers continue to use their bundler's module handling.

The basic open configuration is within the 50 KiB gzip budget; optional-field and hardened downloads add to the total. See `AGENTS.md` and `bun scripts/measure-bundle.ts` for measurements.

## Config

| Field              | Type                                                                                      | Default                               | Description                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`          | `boolean`                                                                                 | `false`                               | Enable the plugin.                                                                                                                                                                   |
| `at`               | `"before" \| "after" \| number`                                                           | `"before"` unless `atPercent` is set  | Initialization, `ended`, or elapsed seconds.                                                                                                                                         |
| `atPercent`        | `number`                                                                                  | —                                     | Threshold percentage of a known duration. With numeric `at`, either threshold triggers the gate; explicit `before`/`after` takes precedence.                                         |
| `webhookUrl`       | `string`                                                                                  | —                                     | Absolute HTTP(S) submission endpoint; requires `challengeUrl`.                                                                                                                       |
| `challengeUrl`     | `string`                                                                                  | —                                     | Absolute HTTP(S) challenge endpoint; requires `webhookUrl`.                                                                                                                          |
| `altchaFormat`     | `"object" \| "base64"`                                                                    | `"object"`                            | Format of the POST `altcha` field. Mailstack/Selfware uses `base64`.                                                                                                                 |
| `product`          | `string`                                                                                  | —                                     | Separate product identifier, 1–100 characters. Empty, whitespace-only, or longer values disable the plugin with `console.warn`.                                                      |
| `privacy`          | `{ text: string; linkText?: string; href?: string }`                                      | —                                     | Text below the email input, connected with `aria-describedby`. Text is rendered literally. A link requires text and an HTTP(S) or relative URL; uses `rel="noopener noreferrer"`.    |
| `marketingConsent` | `{ text: string; version: string; linkText?: string; href?: string; required?: boolean }` | —                                     | Optional checkbox; unchecked and not required by default. Text: 1–500 characters; version: 1–64. Invalid/blank values disable the plugin with a warning. Link rules match `privacy`. |
| `dismissible`      | `boolean`                                                                                 | `true` for `after`, otherwise `false` | Show a dismissal button and allow Escape within the overlay.                                                                                                                         |
| `messages`         | `Partial<EmailGateMessages>`                                                              | English (table below)                 | Override any viewer-facing message, including accessible input label and live status.                                                                                                |
| `title`            | `string`                                                                                  | `"Watch the rest"`                    | Legacy heading override; `messages.title` takes precedence.                                                                                                                          |
| `buttonLabel`      | `string`                                                                                  | `"Continue watching →"`               | Legacy submit override; `messages.submit` takes precedence.                                                                                                                          |
| `storageKey`       | `string`                                                                                  | `"playerstack:email-gate"`            | Memo prefix; the full key is `<prefix>:<src>`.                                                                                                                                       |
| `remember`         | `boolean`                                                                                 | `true`                                | Store a timestamp after success; `false` performs no storage reads or writes.                                                                                                        |
| `rememberDays`     | `number`                                                                                  | No expiry                             | Lifetime in days measured from successful submission. Expired entries are deleted on initialization. Use a finite non-negative value.                                                |

Storage errors do not prevent the form or playback. Existing timestamp memos remain compatible; without `rememberDays`, existing nonempty memos do not expire. No email or product is stored in the memo. Hosts supply privacy wording and retention appropriate to their service.

### Messages

The input has an accessible label. Validation and progress are announced in a polite `role="status"` region. On success the overlay is removed and the success region remains until the player is destroyed.

| Key               | English default                                |
| ----------------- | ---------------------------------------------- |
| `title`           | Watch the rest                                 |
| `emailLabel`      | Email address                                  |
| `placeholder`     | you@example.com                                |
| `submit`          | Continue watching →                            |
| `verifying`       | Verifying…                                     |
| `solving`         | Solving challenge…                             |
| `submitting`      | Submitting…                                    |
| `success`         | Thank you. Your email was received.            |
| `invalidEmail`    | Please enter a valid email address.            |
| `rejected`        | Submission rejected. Please retry.             |
| `rateLimit`       | Too many requests. Please try again later.     |
| `networkError`    | Could not complete verification. Please retry. |
| `dismiss`         | Skip                                           |
| `consentRequired` | Please select the consent checkbox.            |

## Marketing consent

Consent is separate from the contact request. The checkbox starts unchecked. Its visible label uses the configured `text` literally, without HTML; clicking the label toggles the checkbox. An optional link is separate from the label. The checkbox follows the email/privacy block in Tab order, before submit.

Both the `email-gate:submit` event and hardened POST include the same snapshot taken on submit:

| Configuration / selection | Consent fields                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Not configured            | All three fields omitted.                                                                                   |
| Configured, unchecked     | `marketingConsent: false`; `consentVersion` and `consentText` omitted.                                      |
| Checked                   | `marketingConsent: true`, `consentVersion: <version>`, `consentText: <exact configured text without link>`. |

Open mode emits these fields on the bus without a network request. Hardened mode adds them to the existing POST in both object and base64 ALTCHA formats. Consent does not change the challenge URL, nonce handling, or memo. Retry preserves checkbox state; a new attempt takes a new snapshot. No consent text or selection is stored in the player memo.

Set `marketingConsent.required: true` for a list-only signup that requires consent. The plugin sets the native input `required` attribute and blocks submission before any GET or POST when unchecked. It shows `messages.consentRequired`, sets `aria-invalid="true"`, and focuses the checkbox. Selecting it clears `aria-invalid`. With the default `required: false`, an unchecked form is still sent as a contact request.

The backend must validate the consent boolean and the length of version/text. Only `marketingConsent === true` can authorize its list-signup path. Record consent time on the server together with the verified wording version and canonical server-side text. Client `consentText` describes what the page displayed; treat it as supplemental input, not trusted proof of your server's current wording.

## Integrator requirements

- Allow the page's exact origin on the backend. For Sellf this is a seller domain; an unlisted domain produces 403 and the configured rejection message.
- Set `product` to the backend product slug or UUID (1–100 characters). Product selection and authorization belong to the backend.
- `src` is recording/context data only. Never authorize access, select a product, or construct a redirect from it.
- Set `messages.success` to match the backend workflow. Every 2xx response is success regardless of body, including empty, non-JSON, or `{ "status": "check_email" }`. The plugin does not parse a successful response body. A backend that requires email confirmation should say so; 2xx does not itself mean access was granted.

For a Sellf list-only form, omit `product`, require consent, and provide endpoint URLs for that instance. For a product form use its slug/UUID:

```ts
emailGate: {
  enabled: true,
  at: "after",
  product: "free-course",
  webhookUrl: "https://your-sellf.example/api/leads/submit",
  challengeUrl: "https://your-sellf.example/api/leads/challenge",
  marketingConsent: {
    text: "Chcę otrzymywać wiadomości o nowych materiałach i produktach.",
    version: "2026-10",
    required: true,
  },
  messages: {
    success: "Sprawdź pocztę i kliknij link w wiadomości, aby potwierdzić zgłoszenie.",
    consentRequired: "Zaznacz zgodę, aby zapisać się na listę.",
  },
}
```

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

## Keyboard and overlay layers

The form scrolls inside its own player-sized overlay when privacy text, consent, or translations make it taller than the video. Content starts at the top when it overflows; smaller forms remain centered. Pointer, touch scrolling, and keyboard focus scroll the overlay, keeping the player itself in place.

When a focused submit button starts a request, focus moves to the email field before the button is disabled. Focus moved outside the player during a request remains outside when it completes.

The email form uses overlay priority 4, above CTA and intro cards (3) and branded thumbnails (2). Covered player controls and lower overlays are `inert` and excluded from Tab until the form closes. Tab and Shift+Tab can continue to the surrounding page.

An after-video form moves player focus into the email field, including body focus after prior player interaction. Focus outside the player remains unchanged. On dismissal, success, or destroy, focus moves to a remaining overlay or returns to the previous player control, with play/controller or thumbnail fallback. Escape closes the form when `dismissible` is enabled. Closing a before/threshold form resumes playback; closing an after form does not restart the video.

## Events

| Name                 | Payload                                                                                                          | When                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `email-gate:submit`  | `{ email: string; product?: string; marketingConsent?: boolean; consentVersion?: string; consentText?: string }` | POST accepted, or valid open-mode submission. Product omitted if not configured. |
| `email-gate:dismiss` | `{}`                                                                                                             | Dismissal button or Escape when dismissible; no memo.                            |

## License

Apache-2.0.
