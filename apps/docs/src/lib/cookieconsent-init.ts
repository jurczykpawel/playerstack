import ccStyles from "vanilla-cookieconsent/dist/cookieconsent.css?inline";
import * as CC from "vanilla-cookieconsent";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
    __playerstack_gtm_id?: string;
    __playerstack_gtm_loaded?: boolean;
    __playerstack_umami_id?: string;
    __playerstack_umami_src?: string;
    __playerstack_umami_loaded?: boolean;
  }
}

type ConsentCookie = { categories?: string[] };

const LS_KEY = "playerstack_cc_v1";
const COOKIE_NAME = "playerstack_consent";

const saveConsentToStorage = (cats: string[]) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cats));
  } catch {
    /* ignore */
  }
};

const loadConsentFromStorage = (): string[] | null => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const restoreConsentCookie = (cats: string[]) => {
  try {
    const now = new Date().toISOString();
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);
    const id =
      typeof crypto !== "undefined" &&
      typeof (crypto as Crypto & { randomUUID?: () => string }).randomUUID === "function"
        ? (crypto as Crypto & { randomUUID: () => string }).randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const data = {
      categories: cats,
      revision: 0,
      data: null,
      consentTimestamp: now,
      consentId: id,
      services: {},
      languageCode: "en",
      lastConsentTimestamp: now,
    };
    const { hostname, protocol } = window.location;
    let cookie = `${COOKIE_NAME}=${encodeURIComponent(
      JSON.stringify(data),
    )}; expires=${exp.toUTCString()}; Path=/; SameSite=Lax`;
    if (hostname.includes(".")) cookie += `; Domain=${hostname}`;
    if (protocol === "https:") cookie += "; Secure";
    document.cookie = cookie;
  } catch {
    /* ignore */
  }
};

function loadGtm() {
  if (window.__playerstack_gtm_loaded) return;
  const id = window.__playerstack_gtm_id;
  if (!id) return;
  window.__playerstack_gtm_loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  const first = document.getElementsByTagName("script")[0];
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtm.js?id=" + id;
  first.parentNode?.insertBefore(s, first);
}

function loadUmami() {
  if (window.__playerstack_umami_loaded) return;
  const id = window.__playerstack_umami_id;
  if (!id) return;
  window.__playerstack_umami_loaded = true;
  const s = document.createElement("script");
  s.defer = true;
  s.src = window.__playerstack_umami_src || "https://stats.techskills.academy/script.js";
  s.setAttribute("data-website-id", id);
  s.setAttribute("data-domains", "playerstack.techskills.academy");
  document.head.appendChild(s);
}

const updateGtag = (cookie: ConsentCookie) => {
  const cats = cookie.categories || [];
  const has = (c: string) => cats.includes(c);
  saveConsentToStorage(cats);
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: has("analytics") ? "granted" : "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      functionality_storage: "granted",
      security_storage: "granted",
    });
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "cookieconsent_change",
    cookie_categories: cats,
    source_brand: "playerstack",
  });
  if (has("analytics")) {
    loadGtm();
    loadUmami();
  }
};

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const tag = document.createElement("style");
  tag.setAttribute("data-cc-styles", "");
  tag.textContent = ccStyles;
  document.head.appendChild(tag);
}

export async function initCookieConsent() {
  ensureStyles();

  const storedCategories = loadConsentFromStorage();
  const hasCCCookie = document.cookie.includes(COOKIE_NAME + "=");

  if (storedCategories && !hasCCCookie) {
    restoreConsentCookie(storedCategories);
  }

  await CC.run({
    cookie: {
      name: COOKIE_NAME,
      expiresAfterDays: 365,
      sameSite: "Lax",
      path: "/",
    },
    autoShow: !storedCategories,
    guiOptions: {
      consentModal: {
        layout: "box",
        position: "bottom right",
        equalWeightButtons: true,
        flipButtons: false,
      },
      preferencesModal: {
        layout: "box",
        position: "right",
        equalWeightButtons: true,
        flipButtons: false,
      },
    },
    categories: {
      necessary: {
        enabled: true,
        readOnly: true,
      },
      analytics: {
        enabled: false,
        autoClear: {
          cookies: [{ name: /^_ga/ }, { name: "_gid" }],
        },
      },
    },
    language: {
      default: "en",
      translations: {
        en: {
          consentModal: {
            title: "Cookies & privacy",
            description:
              "We use cookies for anonymous analytics so we can see what works. You can change your choice anytime.",
            acceptAllBtn: "Accept all",
            acceptNecessaryBtn: "Reject all",
            showPreferencesBtn: "Manage preferences",
          },
          preferencesModal: {
            title: "Cookie preferences",
            acceptAllBtn: "Accept all",
            acceptNecessaryBtn: "Reject all",
            savePreferencesBtn: "Save preferences",
            closeIconLabel: "Close",
            sections: [
              {
                title: "How we use cookies",
                description:
                  "We only use cookies for anonymous analytics so we can see what works. You decide.",
              },
              {
                title: "Strictly necessary",
                description:
                  "Required for the site to function (consent storage). Always on.",
                linkedCategory: "necessary",
              },
              {
                title: "Analytics",
                description:
                  "Google Analytics 4 (server-side, first-party) and Umami self-hosted. GA4 stores `_ga` (24 months) and `_gid` (24 hours). Umami is cookieless. No cross-site tracking.",
                linkedCategory: "analytics",
              },
              {
                title: "More info",
                description:
                  'Questions? Email <a href="mailto:kontakt@techskills.academy">kontakt@techskills.academy</a>.',
              },
            ],
          },
        },
      },
    },
    onFirstConsent: ({ cookie }) => updateGtag(cookie as ConsentCookie),
    onConsent: ({ cookie }) => updateGtag(cookie as ConsentCookie),
    onChange: ({ cookie }) => updateGtag(cookie as ConsentCookie),
  });

  if (storedCategories && !CC.validConsent()) {
    CC.acceptCategory(storedCategories as string[]);
  }
}

export function showCookiePreferences() {
  ensureStyles();
  CC.showPreferences();
}
