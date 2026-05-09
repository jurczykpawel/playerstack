<template>
  <div class="demo">
    <h1>Playerstack in Vue 3</h1>
    <PlayerStack
      :src="src"
      :title="'Sprite Fight'"
      :config="config"
      :style="{ borderRadius: '12px', overflow: 'hidden', aspectRatio: '16 / 9' }"
    />
    <button @click="swap">Swap source</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import PlayerStack from "./PlayerStack.vue";

const sources = [
  "https://youtu.be/_cMxraX_5RE",
  "https://files.vidstack.io/sprite-fight/720p.mp4",
  "https://vimeo.com/76979871",
];
let idx = 0;
const src = ref(sources[0]);

const config = ref({
  controls: { accent: "#008aff" },
  ctaEnd: {
    enabled: true,
    button: { label: "Subscribe", url: "https://example.com/subscribe" },
    showReplay: true,
  },
});

function swap() {
  idx = (idx + 1) % sources.length;
  src.value = sources[idx];
}
</script>

<style scoped>
.demo {
  max-width: 720px;
  margin: 32px auto;
  padding: 0 16px;
  font-family: system-ui, sans-serif;
}
button {
  margin-top: 16px;
  padding: 8px 16px;
  background: #008aff;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
</style>
