import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { build } = createRequire(resolve("packages/embed/package.json"))("esbuild");
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

let host: Server;
let origin: string;
let bundle: Uint8Array;
let received: Record<string, unknown>[];
let challenges: string[];
let remoteRequests: string[];

test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `
      import { createSellfConfigProvider } from "./packages/plugin-sellf-adapter/src/index";
      import { emailGatePlugin } from "./packages/plugin-email-gate/src/index";
      import { createEventBus } from "./packages/core/src/index";
      (async () => {
        const container = document.querySelector("#player");
        const config = await createSellfConfigProvider({ baseUrl: location.origin,
          ...(location.pathname === "/trusted" ? { trustedOrigins: [location.origin] } : {
          endpoints: { emailGate: { webhook: location.origin + "/lead", challenge: location.origin + "/challenge" } } })
        }).load(container);
        const mediaPlayer = document.createElement("video");
        container.append(mediaPlayer);
        await emailGatePlugin.init({ container, config, mediaPlayer, events: createEventBus() });
        document.querySelector("#end").onclick = () => mediaPlayer.dispatchEvent(new Event("ended"));
      })();`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
  });
  bundle = result.outputFiles![0]!.contents;
  host = createServer(async (req, res) => {
    if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(bundle);
    } else if (req.url?.startsWith("/remote-")) {
      remoteRequests.push(req.url);
      res.writeHead(500).end();
    } else if (req.url === "/api/products/guide/playerstack") {
      const trusted = req.headers.referer === origin + "/trusted";
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          src: "movie.mp4",
          emailGate: {
            enabled: true,
            at: "after",
            product: " guide ",
            remember: false,
            altchaFormat: "base64",
            marketingConsent: { text: "Send updates", version: "v1", required: true },
            messages: { title: "Get the guide", submit: "Send", success: "Check email" },
            webhookUrl: origin + (trusted ? "/lead" : "/remote-lead"),
            challengeUrl: origin + (trusted ? "/challenge" : "/remote-challenge"),
          },
        }),
      );
    } else if (req.url?.startsWith("/challenge")) {
      challenges.push(req.url);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          nonce: "nonce",
          altcha: {
            algorithm: "SHA-256",
            salt: "test",
            maxnumber: 0,
            signature: "test",
            challenge: "590c9f8430c7435807df8ba9a476e3f1295d46ef210f6efae2043a4c085a569e",
          },
        }),
      );
    } else if (req.url === "/lead") {
      let body = "";
      for await (const chunk of req) body += chunk;
      received.push(JSON.parse(body));
      res.writeHead(204).end();
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><button id="end">Finish video</button><div id="player" data-sellf-product="guide" style="position:relative;width:640px;height:360px"></div><script src="/bundle.js"></script>',
      );
    }
  });
  await new Promise<void>((done) => host.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(host.address() as AddressInfo).port}`;
});
test.afterAll(async () => {
  host.closeAllConnections();
  await new Promise<void>((done, reject) =>
    host.close((error) => (error ? reject(error) : done())),
  );
});

for (const path of ["/", "/trusted"]) {
  test(`submits the product and required consent from Sellf after playback (${path})`, async ({
    page,
  }) => {
    remoteRequests = [];
    received = [];
    challenges = [];
    await page.goto(origin + path);
    await expect(page.locator("#player video")).toHaveCount(1);
    await expect(page.locator("form")).toHaveCount(0);
    await page.getByRole("button", { name: "Finish video" }).click();
    await expect(page.getByText("Get the guide")).toBeVisible();
    await page.getByRole("textbox", { name: "Email address" }).fill("viewer@example.com");
    const checkbox = page.getByRole("checkbox", { name: "Send updates" });
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toHaveAttribute("required", "");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    expect(challenges).toEqual([]);
    await checkbox.check();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Check email");
    expect(challenges).toEqual(["/challenge?product=guide"]);
    expect(received).toHaveLength(1);
    expect(remoteRequests).toEqual([]);
    expect(received[0]).toMatchObject({
      product: "guide",
      marketingConsent: true,
      consentVersion: "v1",
      consentText: "Send updates",
      nonce: "nonce",
    });
    expect(typeof received[0]!.altcha).toBe("string");
    expect(
      JSON.parse(Buffer.from(received[0]!.altcha as string, "base64").toString()),
    ).toMatchObject({ number: 0 });
  });
}
