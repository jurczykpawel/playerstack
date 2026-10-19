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

const PLAYERSTACK_URL = "https://playerstack.techskills.academy/playerstack.min.js";
let scriptPromise: Promise<void> | null = null;

function loadPlayerstack(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (customElements.get("player-stack")) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = PLAYERSTACK_URL;
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
