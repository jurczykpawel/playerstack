<template>
  <div ref="host" :class="className" :style="style" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";

interface Props {
  src: string;
  poster?: string;
  title?: string;
  config?: Record<string, unknown>;
  className?: string;
  style?: Record<string, string>;
}

const props = defineProps<Props>();
const host = ref<HTMLDivElement | null>(null);

const PLAYERSTACK_VERSION = "0.1.0";
const VIDSTACK_VERSION = "1.12.13";
let scriptPromise: Promise<void> | null = null;

function loadPlayerstack(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (!document.querySelector("link[data-playerstack-styles]")) {
      const link1 = document.createElement("link");
      link1.rel = "stylesheet";
      link1.href = `https://cdn.jsdelivr.net/npm/vidstack@${VIDSTACK_VERSION}/player/styles/default/theme.css`;
      link1.dataset.playerstackStyles = "theme";
      document.head.appendChild(link1);

      const link2 = document.createElement("link");
      link2.rel = "stylesheet";
      link2.href = `https://cdn.jsdelivr.net/npm/vidstack@${VIDSTACK_VERSION}/player/styles/default/layouts/video.css`;
      link2.dataset.playerstackStyles = "layout";
      document.head.appendChild(link2);
    }

    if (customElements.get("player-stack")) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://cdn.jsdelivr.net/npm/playerstack@${PLAYERSTACK_VERSION}/dist/playerstack.min.js`;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load playerstack"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function render() {
  if (!host.value) return;
  host.value.innerHTML = "";
  const el = document.createElement("player-stack");
  el.setAttribute("src", props.src);
  if (props.poster) el.setAttribute("poster", props.poster);
  if (props.title) el.setAttribute("title", props.title);
  if (props.config) el.setAttribute("data-config", JSON.stringify(props.config));
  host.value.appendChild(el);
}

onMounted(async () => {
  await loadPlayerstack();
  render();
});

watch(
  () => [props.src, props.poster, props.title, JSON.stringify(props.config ?? {})],
  () => render(),
);

onUnmounted(() => {
  if (host.value) host.value.innerHTML = "";
});
</script>
