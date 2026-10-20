import { test, expect, type Page } from "@playwright/test";
import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { join, extname } from "path";

// Serves the built docs site (apps/docs/dist) from a fake origin and checks that
// no page scrolls sideways on a phone. Run `bun run --cwd apps/docs build`
// first (CI does).
const DIST = join(__dirname, "../../apps/docs/dist");
const ORIGIN = "https://site.test";

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".txt": "text/plain",
};

// Every built HTML page, as a URL path ("/" and "/docs/api/").
function pagesIn(dir: string, prefix = "/"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return pagesIn(join(dir, entry.name), `${prefix}${entry.name}/`);
    return entry.name === "index.html" ? [prefix] : [];
  });
}

const PAGES = existsSync(DIST) ? pagesIn(DIST) : [];
const WIDTHS = [320, 375];

test.skip(!existsSync(join(DIST, "index.html")), "docs site not built");
test("the docs site has pages to check", () => {
  expect(PAGES.length).toBeGreaterThan(5);
});

async function serveDist(page: Page) {
  await page.route(`${ORIGIN}/**`, (route) => {
    const { pathname } = new URL(route.request().url());
    let file = join(DIST, decodeURIComponent(pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return route.fulfill({ status: 404 });
    return route.fulfill({
      body: readFileSync(file),
      contentType: TYPES[extname(file)] ?? "application/octet-stream",
    });
  });
  // Anything off-origin (fonts, hosted script, video) is not part of the layout check.
  await page.route(/^https?:\/\/(?!site\.test)/, (route) => route.abort());
}

for (const width of WIDTHS) {
  for (const path of PAGES) {
    test(`no horizontal overflow at ${width}px: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await serveDist(page);
      await page.goto(`${ORIGIN}${path}`, { waitUntil: "load" });

      const { scrollWidth, clientWidth, offenders } = await page.evaluate(() => {
        const root = document.documentElement;
        const wide = [...document.body.querySelectorAll<HTMLElement>("*")]
          .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 1)
          .slice(0, 8)
          .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`);
        return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, offenders: wide };
      });

      expect(
        scrollWidth,
        `elements past the right edge: ${offenders.join(", ")}`,
      ).toBeLessThanOrEqual(clientWidth);
    });
  }
}
