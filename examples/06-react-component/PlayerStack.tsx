"use client";

import { useEffect, useRef } from "react";

/**
 * React wrapper around Playerstack's <player-stack> custom element.
 *
 * Loads the Playerstack bundle once on mount and renders the custom element.
 * Handles SSR safely — the script is only loaded in the browser.
 *
 * Usage:
 *   <PlayerStack
 *     src="https://youtu.be/dQw4w9WgXcQ"
 *     config={{ controls: { accent: "#008aff" } }}
 *   />
 */

interface PlayerStackProps {
  src: string;
  poster?: string;
  title?: string;
  config?: Record<string, unknown>;
  className?: string;
  style?: React.CSSProperties;
}

const PLAYERSTACK_VERSION = "0.1.0";
const VIDSTACK_VERSION = "1.12.13";
let scriptPromise: Promise<void> | null = null;

function loadPlayerstack(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    // Load Vidstack styles once
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

export function PlayerStack({ src, poster, title, config, className, style }: PlayerStackProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPlayerstack().then(() => {
      if (cancelled || !hostRef.current) return;
      const host = hostRef.current;
      host.innerHTML = "";

      const el = document.createElement("player-stack");
      el.setAttribute("src", src);
      if (poster) el.setAttribute("poster", poster);
      if (title) el.setAttribute("title", title);
      if (config) el.setAttribute("data-config", JSON.stringify(config));
      host.appendChild(el);
    });

    return () => {
      cancelled = true;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
    // We rebuild the element when these change — Playerstack's custom element
    // will re-init via connectedCallback every time.
  }, [src, poster, title, JSON.stringify(config ?? {})]);

  return <div ref={hostRef} className={className} style={style} />;
}
