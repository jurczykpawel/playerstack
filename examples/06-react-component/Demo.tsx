import { PlayerStack } from "./PlayerStack";

/**
 * Demo: how to use the React wrapper in any React app.
 *
 * Drop this file (and PlayerStack.tsx) into any React 18+ project.
 * No build step changes needed — Playerstack loads from CDN.
 */
export default function Demo() {
  return (
    <div style={{ maxWidth: 720, margin: "32px auto", padding: "0 16px" }}>
      <h1>Playerstack in React</h1>

      <PlayerStack
        src="https://youtu.be/_cMxraX_5RE"
        title="Sprite Fight"
        config={{
          controls: { accent: "#008aff" },
          ctaEnd: {
            enabled: true,
            title: "Want more like this?",
            button: { label: "Subscribe", url: "https://example.com/subscribe" },
            showReplay: true,
          },
        }}
        style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "16 / 9" }}
      />
    </div>
  );
}
