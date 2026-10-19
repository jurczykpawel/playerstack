// Landing-page copy as structured data so a second locale can be added later
// without touching markup. `en` is the source of truth; add `pl` and a resolver
// when translations are needed.

export interface ConfigLine {
  text: string;
  /** Highlighted (newly added by this step) when true */
  add?: boolean;
  /** Indentation depth (each level = 2 spaces) */
  indent?: number;
}

export interface DemoStep {
  /** Plugin key shown as a chip, e.g. "sources" */
  key: string;
  /** Short label for the progress rail */
  label: string;
  /** Benefit heading */
  title: string;
  /** One- or two-sentence explanation */
  blurb: string;
  /** The data-config rendered for this step (string keys map to player config) */
  config: Record<string, unknown>;
  /** Optional post-mount driver so event-only plugins show their state (e.g. cta-end) */
  action?: "end";
  /** The code panel contents for this step */
  code: ConfigLine[];
}

export interface PluginItem {
  name: string;
  pkg: string;
  desc: string;
}

export interface PluginGroup {
  label: string;
  items: PluginItem[];
}

export const en = {
  meta: {
    title: "Playerstack — the embeddable video player with a marketing layer",
    description:
      "Open-source embeddable video player. One script tag embeds YouTube, Vimeo, MP4 or HLS, then brand it, add CTAs, capture leads and track plays — all via plugins. MIT, framework-free.",
  },

  nav: {
    links: [
      { label: "Live demo", href: "#living-demo" },
      { label: "Plugins", href: "#plugins" },
      { label: "Frameworks", href: "#frameworks" },
      { label: "Docs", href: "/docs" },
      { label: "Playground", href: "/playground" },
    ],
    github: "https://github.com/jurczykpawel/playerstack",
  },

  hero: {
    eyebrow: "Open-source embeddable video player",
    title: "One script tag. A video player that converts.",
    lead: "Embed YouTube, Vimeo, MP4 or HLS on any page — then brand it, add CTAs, capture leads and track every play. Every feature is a plugin. Framework-free, MIT.",
    primary: { label: "Get started", href: "/docs/getting-started" },
    secondary: { label: "Open playground", href: "/playground" },
    install:
      '<script src="https://playerstack.techskills.academy/playerstack.min.js" defer></script>',
    selfHost: {
      label: "Or download the MIT bundle and self-host it",
      href: "/docs/getting-started",
    },
  },

  livingDemo: {
    eyebrow: "Show, don't tell",
    title: "Every feature is a plugin. Scroll to stack them.",
    lead: "The player below is a real, running <player-stack> embedded on this page — not a video of one. As you scroll, each plugin switches on and the config updates live.",
    srcLabel: "your-site.com",
    steps: [
      {
        key: "sources",
        label: "Source",
        title: "Paste a URL. It just works.",
        blurb:
          "Point src at a YouTube, Vimeo, MP4 or HLS link. Playerstack detects the type and mounts the matching engine underneath — no per-source code.",
        config: {},
        code: [
          { text: "<player-stack" },
          { text: 'src="…/demo.mp4">', indent: 1, add: true },
          { text: "</player-stack>" },
        ],
      },
      {
        key: "branded-thumb",
        label: "Branding",
        title: "Own the first frame.",
        blurb:
          "Show a custom poster and load the video only on click — better LCP, and zero third-party cookies until the visitor opts in.",
        config: { brandedThumb: { enabled: true, clickToLoad: true } },
        code: [
          { text: "data-config='{" },
          { text: '"brandedThumb": {', indent: 1, add: true },
          { text: '"enabled": true,', indent: 2, add: true },
          { text: '"clickToLoad": true', indent: 2, add: true },
          { text: "}", indent: 1, add: true },
          { text: "}'" },
        ],
      },
      {
        key: "controls",
        label: "Theme",
        title: "Match your brand in one line.",
        blurb:
          "A single accent color themes the whole player — play button, progress bar, controls. Here it switches from the default to a brand violet.",
        config: {
          brandedThumb: { enabled: true, clickToLoad: true },
          controls: { accent: "#8b5cf6" },
        },
        code: [
          { text: "data-config='{" },
          { text: '"brandedThumb": { … },', indent: 1 },
          { text: '"controls": {', indent: 1, add: true },
          { text: '"accent": "#8b5cf6"', indent: 2, add: true },
          { text: "}", indent: 1, add: true },
          { text: "}'" },
        ],
      },
      {
        key: "cta-end",
        label: "Convert",
        title: "Turn the end screen into a CTA.",
        blurb:
          "When the video ends, overlay a UTM-tagged button with a replay option. The end of the watch becomes the start of a click.",
        config: {
          controls: { accent: "#8b5cf6" },
          ctaEnd: {
            enabled: true,
            title: "Want the full course?",
            button: {
              label: "Get it now",
              url: "https://playerstack.techskills.academy/docs/getting-started",
            },
          },
        },
        action: "end",
        code: [
          { text: "data-config='{" },
          { text: '"controls": { … },', indent: 1 },
          { text: '"ctaEnd": {', indent: 1, add: true },
          { text: '"enabled": true,', indent: 2, add: true },
          { text: '"title": "Want the full course?",', indent: 2, add: true },
          { text: '"button": { "label": "Get it now" }', indent: 2, add: true },
          { text: "}", indent: 1, add: true },
          { text: "}'" },
        ],
      },
      {
        key: "email-gate",
        label: "Capture",
        title: "Gate it behind an email.",
        blurb:
          "Pause playback and ask for an email before the video plays. Open mode emits an event; production mode POSTs to your endpoint with proof-of-work.",
        config: {
          controls: { accent: "#8b5cf6" },
          emailGate: {
            enabled: true,
            at: "before",
            title: "Drop your email to watch",
            buttonLabel: "Unlock video",
          },
        },
        code: [
          { text: "data-config='{" },
          { text: '"controls": { … },', indent: 1 },
          { text: '"emailGate": {', indent: 1, add: true },
          { text: '"enabled": true,', indent: 2, add: true },
          { text: '"at": "before",', indent: 2, add: true },
          { text: '"title": "Drop your email to watch"', indent: 2, add: true },
          { text: "}", indent: 1, add: true },
          { text: "}'" },
        ],
      },
    ] as DemoStep[],
    closer:
      "One element, one config object, five plugins shown live. Mix any of the 17 below — or write your own.",
  },

  sources: {
    eyebrow: "One src attribute",
    title: "Every source, one API.",
    lead: "Playerstack wraps the Mux media ecosystem, so each source exposes a real <video>-style API. Autoplay policy, native events and DOM attributes work the same everywhere.",
    items: ["YouTube", "Vimeo", "Wistia", "Twitch", "Bunny Stream", "MP4", "HLS", "WebM"],
  },

  plugins: {
    eyebrow: "17 plugins, all MIT",
    title: "A plugin for every job. Ship only what you use.",
    lead: "17 first-party plugins are available in the source. The standalone script registers 15; focus-mode and sellf-adapter need a custom build. The scoped @playerstack/* packages let you bundle just what you use from source.",
    groups: [
      {
        label: "Marketing",
        items: [
          {
            name: "Intro card",
            pkg: "intro-card",
            desc: "Pre-roll splash: badge, title, subtitle, CTA and a big play button.",
          },
          {
            name: "Branded thumbnail",
            pkg: "branded-thumb",
            desc: "Custom poster + click-to-load for better LCP and GDPR.",
          },
          {
            name: "End CTA",
            pkg: "cta-end",
            desc: "Overlay a UTM-tagged button when the video ends, with replay.",
          },
          {
            name: "Action bar",
            pkg: "action-bar",
            desc: "A dismissible mid-video banner with its own call to action.",
          },
          {
            name: "Email gate",
            pkg: "email-gate",
            desc: "Pause and require an email before playback continues.",
          },
          {
            name: "YouTube subscribe",
            pkg: "yt-subscribe",
            desc: "A subscribe bar below the player linking to a channel.",
          },
          {
            name: "Autopreview",
            pkg: "autopreview",
            desc: "Muted autoplay in view, paused out — respects reduced-motion.",
          },
        ],
      },
      {
        label: "E-learning",
        items: [
          {
            name: "Chapters",
            pkg: "chapters",
            desc: "A clickable chapter list that syncs with playback.",
          },
          {
            name: "Saved position",
            pkg: "saved-position",
            desc: "Resume from where the visitor left off.",
          },
          { name: "Focus mode", pkg: "focus-mode", desc: "Auto-pause when the tab loses focus." },
        ],
      },
      {
        label: "Performance & UX",
        items: [
          {
            name: "Sources",
            pkg: "sources",
            desc: "Auto-detect YouTube, Vimeo, MP4, HLS, WebM and DASH from one URL.",
          },
          {
            name: "Controls policy",
            pkg: "controls-policy",
            desc: "Accent theme plus a whitelist for which controls show.",
          },
          {
            name: "Sticky",
            pkg: "sticky",
            desc: "Pin to a corner when scrolled past during playback.",
          },
        ],
      },
      {
        label: "Branding",
        items: [
          {
            name: "Watermark",
            pkg: "watermark",
            desc: "A corner-pinned logo or text overlay, optional click-through.",
          },
          {
            name: "Custom CSS",
            pkg: "custom-css",
            desc: "Inject scoped CSS — the escape hatch for anything else.",
          },
        ],
      },
      {
        label: "Analytics & integrations",
        items: [
          {
            name: "Analytics",
            pkg: "analytics",
            desc: "Forward events to a beacon endpoint or GA4 via gtag.",
          },
          {
            name: "Config adapter",
            pkg: "sellf-adapter",
            desc: "Load player config from a remote product endpoint.",
          },
        ],
      },
    ] as PluginGroup[],
  },

  why: {
    eyebrow: "Why Playerstack",
    title: "The marketing layer, without the lock-in.",
    cards: [
      {
        title: "Engines stop at playback",
        body: "Developer-focused players nail playback, but branding, CTAs and lead capture are left for you to build. You ship plumbing instead of features.",
      },
      {
        title: "Funnel players lock you in",
        body: "The players that do have a marketing layer live inside a single platform you must adopt wholesale — one CMS, one stack, one way.",
      },
      {
        title: "Playerstack is both, anywhere",
        body: "A modern Web Component you drop on any page: the marketing layer of the first kind, the openness of the second. MIT, framework-free, yours to extend.",
      },
    ],
  },

  frameworks: {
    eyebrow: "Works where you do",
    title: "It's a custom element. It runs everywhere.",
    lead: "Because it's a standard Web Component, there's nothing to wrap. Copy-paste examples ship for every common stack.",
    items: [
      "Vanilla HTML",
      "React",
      "Vue",
      "Astro",
      "Next.js",
      "Tailwind",
      "WordPress",
      "Multi-instance",
      "Click-to-load",
      "Analytics",
      "Custom plugin",
      "Remote config",
    ],
    snippet:
      `<script src="https://playerstack.techskills.academy/playerstack.min.js" defer></scr` +
      `ipt>

<player-stack
  src="https://youtu.be/dQw4w9WgXcQ"
  data-config='{"controls":{"accent":"#008aff"},
    "ctaEnd":{"enabled":true,
      "button":{"label":"Buy now","url":"https://example.com"}}}'>
</player-stack>`,
  },

  trust: {
    items: [
      { value: "MIT", label: "Core + all 17 plugins" },
      { value: "~239 KiB", label: "Hosted standalone, gzip (2026-10-19)" },
      { value: "0 deps", label: "to start — one script tag" },
      { value: "Mux", label: "media-chrome engine, never forked" },
    ],
  },

  faq: {
    eyebrow: "Questions",
    title: "The short answers.",
    items: [
      {
        q: "Is it really free for commercial use?",
        a: "Yes. The core and all 17 plugins are MIT-licensed. Use it in client work, products and SaaS without a license fee.",
      },
      {
        q: "Does it work with my framework?",
        a: "It's a standard custom element, so it works with plain HTML and with React, Vue, Svelte, Astro, Next.js or anything that renders HTML. Examples ship for each.",
      },
      {
        q: "What about GDPR and cookies?",
        a: "The branded-thumbnail plugin loads the video only on click, so no third-party cookies are set until the visitor opts in. That also improves your LCP.",
      },
      {
        q: "How big is it?",
        a: "The hosted standalone script measured about 239 KiB with gzip or 194 KiB with Brotli on 2026-10-19. It includes the media elements and 15 registered plugins. Build from the scoped @playerstack/* source packages to select your own plugins; size depends on the build and compression settings.",
      },
      {
        q: "How do plugins work?",
        a: "Each plugin gets an init(ctx) with an event bus, the media element, the container and the resolved config. Write your own in a few lines with the same contract.",
      },
    ],
  },

  finalCta: {
    eyebrow: "Ship it",
    title: "Add a real video player in one line.",
    lead: "Drop the script tag, add a <player-stack>, and configure it with one attribute. Everything else is a plugin.",
    primary: { label: "Read the docs", href: "/docs/getting-started" },
    secondary: { label: "Open playground", href: "/playground" },
    github: "https://github.com/jurczykpawel/playerstack",
  },
} as const;

export type LandingContent = typeof en;
