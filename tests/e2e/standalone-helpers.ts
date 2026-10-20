import { test, expect, type Page, type Request } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const DIST = join(__dirname, "../../packages/embed/dist");
export const ORIGIN = "https://ps.test";
export const SCRIPT = `${ORIGIN}/assets/playerstack.min.js`;

export const SOURCES = {
  youtube: "https://youtu.be/_cMxraX_5RE",
  mp4: "https://media.w3.org/2010/05/sintel/trailer.mp4",
  hls: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  vimeo: "https://vimeo.com/76979871",
};

export function observeStandalone(): void {
  test.skip(!existsSync(join(DIST, "playerstack.min.js")), "standalone bundle not built");
  const observations = new WeakMap<
    Page,
    { requests: string[]; console: string[]; pageErrors: string[] }
  >();
  test.beforeEach(({ page }) => {
    const observation = {
      requests: [] as string[],
      console: [] as string[],
      pageErrors: [] as string[],
    };
    observations.set(page, observation);
    page.on("request", (request) => observation.requests.push(request.url()));
    page.on("console", (message) =>
      observation.console.push(`${message.type()}: ${message.text()}`),
    );
    page.on("pageerror", (error) => observation.pageErrors.push(error.message));
  });
  test.afterEach(async ({ page }, info) => {
    const observation = observations.get(page)!;
    await info.attach("browser-observation", {
      body: JSON.stringify(observation, null, 2),
      contentType: "application/json",
    });
    expect(observation.pageErrors).toEqual([]);
  });
}

export async function openEmbed(
  page: Page,
  src: string,
  config?: Record<string, unknown>,
  beforeFile?: (file: string) => Promise<boolean>,
): Promise<string[]> {
  const fetched: string[] = [];
  page.on("request", (req: Request) => {
    if (req.url().startsWith(`${ORIGIN}/assets/`)) fetched.push(req.url().split("/").pop()!);
  });
  await page.route(`${ORIGIN}/assets/*`, async (route) => {
    const file = new URL(route.request().url()).pathname.split("/").pop()!;
    if (beforeFile && !(await beforeFile(file))) return route.abort();
    const path = join(DIST, file);
    if (!existsSync(path)) return route.fulfill({ status: 404 });
    return route.fulfill({ body: readFileSync(path), contentType: "application/javascript" });
  });
  await page.route(`${ORIGIN}/`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta charset="utf-8"></head><body>
        <player-stack src="${src}" ${config ? `data-config='${JSON.stringify(config).replace(/'/g, "&#39;")}'` : ""} style="display:block;width:640px;height:360px"></player-stack>
        <script src="${SCRIPT}"></script>
      </body></html>`,
    }),
  );
  await page.goto(`${ORIGIN}/`);
  return fetched;
}

export const lazyFiles = (files: string[]) => files.filter((f) => f !== "playerstack.min.js");
