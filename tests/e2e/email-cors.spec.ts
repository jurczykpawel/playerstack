import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AddressInfo } from "node:net";

const dist = process.env.PLAYERSTACK_DIST || resolve("packages/embed/dist");
const challenge = {
  altcha: {
    algorithm: "SHA-256",
    challenge: "590c9f8430c7435807df8ba9a476e3f1295d46ef210f6efae2043a4c085a569e",
    salt: "test",
    signature: "test",
    maxnumber: 0,
  },
  nonce: "test-nonce",
};
async function listen(server: Server) {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((done, reject) =>
    server.close((error) => (error ? reject(error) : done())),
  );
}

test("submits across origins with exact Allow-Origin and no Allow-Credentials", async ({
  page,
  context,
}) => {
  let origin = "";
  const received: { method: string; cookie?: string; origin?: string; body: string }[] = [];
  const api = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    received.push({
      method: req.method!,
      cookie: req.headers.cookie,
      origin: req.headers.origin,
      body,
    });
    if (req.url === "/challenge") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(challenge));
    } else res.writeHead(204).end();
  });
  const apiOrigin = await listen(api);
  const host = createServer((req, res) => {
    if (req.url?.startsWith("/assets/")) {
      res.setHeader("Content-Type", "application/javascript");
      res.end(readFileSync(resolve(dist, req.url.split("?")[0]!.split("/").pop()!)));
      return;
    }
    const config = {
      preload: "none",
      emailGate: {
        enabled: true,
        at: "before",
        remember: false,
        challengeUrl: `${apiOrigin}/challenge`,
        webhookUrl: `${apiOrigin}/lead`,
      },
    };
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><player-stack src="${origin}/movie.mp4" style="display:block;width:640px;height:360px" data-config='${JSON.stringify(config)}'></player-stack><script src="/assets/playerstack.min.js"></script>`,
    );
  });
  try {
    origin = await listen(host);
    await context.addCookies([{ name: "session", value: "fixture", url: apiOrigin }]);
    await page.goto(origin);
    const gate = page.locator(".playerstack-email-gate");
    await expect(gate, "source resolution must mount the gate before testing CORS").toBeVisible();
    await gate.locator("input[type=email]").fill("viewer@example.com");
    await gate.locator("button[type=submit]").click();
    await expect
      .poll(() => received.filter((request) => request.method === "POST").length, {
        message: "CORS must permit the POST without Allow-Credentials (credentials: omit)",
      })
      .toBe(1);
    await expect(gate).toHaveCount(0);
    expect(received.map((r) => r.method)).toEqual(["GET", "POST"]);
    for (const request of received) {
      expect(request.origin).toBe(origin);
      expect(request.cookie).toBeUndefined();
    }
    expect(JSON.parse(received[1]!.body)).toMatchObject({
      email: "viewer@example.com",
      nonce: "test-nonce",
      altcha: { number: 0 },
    });
  } finally {
    await close(host);
    await close(api);
  }
});
