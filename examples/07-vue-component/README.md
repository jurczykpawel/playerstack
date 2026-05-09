# 07 — Vue 3 component

Vue 3 SFC wrapper with reactive props. Same pattern as the React wrapper but using Vue's lifecycle hooks.

## Files

- `PlayerStack.vue` — reusable component
- `Demo.vue` — example with reactive source switching

## Usage

```vue
<template>
  <PlayerStack :src="videoUrl" :config="{ controls: { accent: '#008aff' } }" />
</template>

<script setup>
import PlayerStack from "./PlayerStack.vue";
const videoUrl = "https://youtu.be/dQw4w9WgXcQ";
</script>
```

## Reactivity

The wrapper watches `[src, poster, title, config]` and re-renders the player when any of them change. The Demo shows this — clicking "Swap source" changes the URL and the player re-mounts.

## Nuxt

For Nuxt 3+, drop `PlayerStack.vue` into `components/` and use it directly. Nuxt handles SSR — the component renders an empty `<div>` on the server (because `onMounted` only runs on the client) and hydrates with the player on the client. No `client-only` wrapper needed.
