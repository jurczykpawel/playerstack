/**
 * Public protocol contract between Playerstack's email-gate plugin and your
 * server. Both halves MUST conform — the plugin will refuse to submit if the
 * response shape doesn't match.
 *
 * Implement on YOUR server:
 *  - `GET <challengeUrl>` returns `LeadsChallenge`
 *  - `POST <webhookUrl>` accepts `LeadsSubmission`, returns 2xx on success
 *
 * Use altcha-lib v2.x for `createChallenge` / `verifySolution` server-side.
 * Track `nonce` in your store (Redis recommended) for single-use enforcement.
 */

/** Server response from `GET <challengeUrl>` — issued anew for every submission attempt. */
export interface LeadsChallenge {
  /** Altcha proof-of-work challenge from `altcha-lib createChallenge()`. */
  altcha: {
    algorithm: "SHA-1" | "SHA-256" | "SHA-512";
    challenge: string;
    maxnumber?: number;
    salt: string;
    signature: string;
  };
  /**
   * Single-use nonce. Server MUST track this in a TTL store (Redis SETNX, etc)
   * and reject any submission that doesn't match an unused, non-expired nonce.
   */
  nonce: string;
}

/** Body of `POST <webhookUrl>` after the user submits the form. */
export interface LeadsSubmission {
  /** User-provided email. */
  email: string;
  /** Source URL of the video that displayed the gate. */
  src: string;
  /** Optional product identifier, 1–100 characters; validated by the server. */
  product?: string;
  /** Omitted when not configured; false for contact only, true when selected. */
  marketingConsent?: boolean;
  /** Consent wording version, present only when selected. */
  consentVersion?: string;
  /** Exact configured label text, without its optional link; present only when selected. */
  consentText?: string;
  /** Echoed nonce from the challenge — must be marked consumed on the first POST carrying it, regardless of outcome. */
  nonce: string;
  /** ALTCHA object by default, or base64 UTF-8 JSON when `altchaFormat` is "base64". */
  altcha:
    | string
    | {
        algorithm: "SHA-1" | "SHA-256" | "SHA-512";
        challenge: string;
        number: number;
        salt: string;
        signature: string;
      };
}
