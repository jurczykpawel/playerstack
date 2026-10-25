import type { LeadsChallenge, LeadsSubmission } from "./types";
import { solveChallenge } from "altcha-lib";
import type { EmailGateConfig } from "./index";

function isChallenge(value: unknown): value is LeadsChallenge {
  if (!value || typeof value !== "object") return false;
  const { altcha, nonce } = value as Partial<LeadsChallenge>;
  return (
    typeof nonce === "string" &&
    nonce.trim().length > 0 &&
    !!altcha &&
    ["SHA-1", "SHA-256", "SHA-512"].includes(altcha.algorithm) &&
    [altcha.challenge, altcha.salt, altcha.signature].every(
      (field) => typeof field === "string" && field.length > 0,
    ) &&
    (altcha.maxnumber === undefined ||
      (Number.isSafeInteger(altcha.maxnumber) && altcha.maxnumber >= 0))
  );
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
  const challenge: unknown = await challengeRes.json();
  if (!active()) return;
  if (!isChallenge(challenge)) {
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
    nonce: challenge.nonce,
    altcha: cfg.altchaFormat === "base64" ? encodePayload(payload) : payload,
  };
  const submitRes = await fetch(cfg.webhookUrl!, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(submission),
  });
  if (!submitRes.ok) {
    fail(submitRes.status);
    return;
  }
  success();
}
