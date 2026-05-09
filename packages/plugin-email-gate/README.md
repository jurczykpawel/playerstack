# @playerstack/plugin-email-gate

Lead capture: pause the video and show an email form before the visitor can keep watching. Submission is remembered in `localStorage` so the same browser doesn't see the gate twice. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-email-gate
```

## Use

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

| Field         | Type                 | Default                    | Description                                                               |
| ------------- | -------------------- | -------------------------- | ------------------------------------------------------------------------- |
| `enabled`     | boolean              | `false`                    | Plugin is a no-op unless `true`                                           |
| `at`          | `"before" \| number` | `"before"`                 | `"before"` shows on init. A number ≤ 100 = % of duration, > 100 = seconds |
| `title`       | string?              | `"Watch the rest"`         | Heading text inside the form                                              |
| `buttonLabel` | string?              | `"Continue watching →"`    | Submit button label                                                       |
| `webhookUrl`  | string?              | none                       | If set, POST `{ email, src }` JSON to this URL on submit                  |
| `storageKey`  | string?              | `"playerstack:email-gate"` | localStorage key prefix; full key is `${prefix}:${src}`                   |

## Events

| Name                | Payload     | When                       |
| ------------------- | ----------- | -------------------------- |
| `email-gate:submit` | `{ email }` | User submits a valid email |

## License

MIT.
