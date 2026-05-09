"use client";

import { useEffect, useRef } from "react";

/**
 * Next.js 13+ App Router wrapper. Note the "use client" directive.
 *
 * For full SSR safety, also wrap usage with `dynamic()` (see usage.tsx).
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

export function PlayerStack({ src, poster, title, config, className, style }: PlayerStackProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ensureLoaded = async () => {
      if (typeof window === "undefined") return;

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

      if (!customElements.get("player-stack")) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `https://cdn.jsdelivr.net/npm/playerstack@${PLAYERSTACK_VERSION}/dist/playerstack.min.js`;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Playerstack failed to load"));
          document.head.appendChild(script);
        });
      }

      if (cancelled || !hostRef.current) return;
      hostRef.current.innerHTML = "";
      const el = document.createElement("player-stack");
      el.setAttribute("src", src);
      if (poster) el.setAttribute("poster", poster);
      if (title) el.setAttribute("title", title);
      if (config) el.setAttribute("data-config", JSON.stringify(config));
      hostRef.current.appendChild(el);
    };

    void ensureLoaded();
    return () => {
      cancelled = true;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [src, poster, title, JSON.stringify(config ?? {})]);

  return <div ref={hostRef} className={className} style={style} />;
}
