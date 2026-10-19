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

const PLAYERSTACK_URL = "https://playerstack.techskills.academy/playerstack.min.js";

export function PlayerStack({ src, poster, title, config, className, style }: PlayerStackProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ensureLoaded = async () => {
      if (typeof window === "undefined") return;

      if (!customElements.get("player-stack")) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = PLAYERSTACK_URL;
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
