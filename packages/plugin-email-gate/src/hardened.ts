import type { LeadsChallenge, LeadsSubmission } from "./types";
import { solveChallenge } from "altcha-lib";
import type { EmailGateConfig } from "./index";

type Altcha = LeadsChallenge["altcha"];
function isAltcha(altcha: unknown): altcha is Altcha {
  if (!altcha || typeof altcha !== "object") return false;
  const { algorithm, challenge, salt, signature, maxnumber } = altcha as Partial<Altcha>;
  return (
    ["SHA-1", "SHA-256", "SHA-512"].includes(algorithm!) &&
    [challenge, salt, signature].every((field) => typeof field === "string" && field.length > 0) &&
    (maxnumber === undefined || (Number.isSafeInteger(maxnumber) && maxnumber >= 0))
  );
}

/** Default mode: `{altcha, nonce}`. Mode "altcha": the flat ALTCHA challenge, no nonce. */
function readChallenge(value: unknown, mode: EmailGateConfig["challengeMode"]) {
  if (mode === "altcha") return isAltcha(value) ? { altcha: value } : null;
  const { altcha, nonce } = (value ?? {}) as Partial<LeadsChallenge>;
  return typeof nonce === "string" && nonce.trim().length > 0 && isAltcha(altcha)
    ? { altcha, nonce }
    : null;
}

function encodePayload(payload: Exclude<LeadsSubmission["altcha"], string>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}

interface HardenedArgs {
  cfg: EmailGateConfig;
  src: string;
  email: string;
  consent: Pick<LeadsSubmission, "marketingConsent" | "consentVersion" | "consentText">;
  response: Promise<{ value?: Response }>;
  active: () => boolean;
  success: () => void;
  fail: () => void;
  setStatus: (message: string) => void;
}
export async function submitChallenge(args: HardenedArgs): Promise<void> {
  const { cfg, src, email, consent, response, active, success, setStatus } = args;
  const fail = (code?: number) => {
    if (!active()) return;
    args.fail();
    const key =
      code === 429
        ? "rateLimit"
        : code !== undefined && code >= 400 && code < 500
          ? "rejected"
          : "networkError";
    setStatus(
      cfg.messages?.[key] ??
        {
          rateLimit: "Too many requests. Please try again later.",
          rejected: "Submission rejected. Please retry.",
          networkError: "Could not complete verification. Please retry.",
        }[key],
    );
  };
  const { value: challengeRes } = await response;
  if (!active()) return;
  if (!challengeRes?.ok) {
    fail(challengeRes?.status);
    return;
  }
  const challenge = readChallenge(await challengeRes.json(), cfg.challengeMode);
  if (!active()) return;
  if (!challenge) {
    fail();
    return;
  }
  setStatus(cfg.messages?.solving ?? "Solving challenge…");
  const { promise } = solveChallenge(
    challenge.altcha.challenge,
    challenge.altcha.salt,
    challenge.altcha.algorithm,
    challenge.altcha.maxnumber,
  );
  const solution = await promise;
  if (!active()) return;
  if (!solution) {
    fail();
    return;
  }

  setStatus(cfg.messages?.submitting ?? "Submitting…");
  const payload = {
    algorithm: challenge.altcha.algorithm,
    challenge: challenge.altcha.challenge,
    salt: challenge.altcha.salt,
    signature: challenge.altcha.signature,
    number: solution.number,
  };
  const submission: LeadsSubmission = {
    email,
    src,
    ...consent,
    ...(cfg.product === undefined ? {} : { product: cfg.product }),
    ...(challenge.nonce === undefined ? {} : { nonce: challenge.nonce }),
    altcha: cfg.altchaFormat === "base64" ? encodePayload(payload) : payload,
  };
  const submitRes = await fetch(cfg.webhookUrl!, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(submission),
  });
  if (!submitRes.ok) {
    fail(submitRes.status);
    return;
  }
  success();
}
