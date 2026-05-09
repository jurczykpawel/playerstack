# @playerstack/plugin-yt-subscribe

Render a "Subscribe on YouTube" bar below the player linking to a channel's subscribe confirmation. Part of [Playerstack](https://github.com/jurczykpawel/playerstack).

Included in the standalone [`playerstack`](https://www.npmjs.com/package/playerstack) bundle.

## Install

```sh
npm install @playerstack/core @playerstack/plugin-yt-subscribe
```

## Use

```html
<!-- By channel UC… ID (preferred — opens subscribe-confirm popup) -->
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{
    "ytSubscribe": {
      "enabled": true,
      "channelId": "UCuAXFkgsw1L7xaCfnd5JJOw",
      "label": "Subscribe to Rick Astley"
    }
  }'
>
</player-stack>

<!-- Or by @handle -->
<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{ "ytSubscribe": { "enabled": true, "channelHandle": "RickAstleyVEVO" } }'
>
</player-stack>
```

## Config

`config.ytSubscribe`:

| Field           | Type    | Description                                                                      |
| --------------- | ------- | -------------------------------------------------------------------------------- |
| `enabled`       | boolean | Plugin is a no-op unless `true`                                                  |
| `channelId`     | string? | YouTube channel `UC…` ID. URL gets `?sub_confirmation=1` for one-click subscribe |
| `channelHandle` | string? | YouTube `@handle` (alternative to channelId)                                     |
| `label`         | string? | Visible button text. Default `"Subscribe on YouTube"`                            |

Either `channelId` OR `channelHandle` is required.

## Events

None.

## License

MIT.
