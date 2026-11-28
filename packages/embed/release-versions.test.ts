import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { carryVersions, stageVersion, type VersionManifest } from "./release-versions";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function dir(): string {
  const root = mkdtempSync(join(tmpdir(), "playerstack-versions-"));
  roots.push(root);
  return root;
}

function release(root: string, main = "main v1"): void {
  writeFileSync(join(root, "playerstack.min.js"), main);
  writeFileSync(join(root, "playerstack.min.js.LEGAL.txt"), "notices");
  writeFileSync(join(root, "playerstack-hls.js"), "hls");
  writeFileSync(join(root, "playerstack-hls.js.LEGAL.txt"), "hls notices");
  writeFileSync(join(root, "demo.mp4"), "not part of the release");
}

const sri = (text: string) => `sha384-${createHash("sha384").update(text).digest("base64")}`;
const manifest = (root: string): VersionManifest =>
  JSON.parse(readFileSync(join(root, "v/versions.json"), "utf8"));

function server(files: Record<string, string>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    const body = files[path];
    return body === undefined
      ? new Response("not found", { status: 404 })
      : new Response(body, { status: 200 });
  }) as typeof fetch;
}

describe("stageVersion", () => {
  it("copies the standalone release into v/<content id>/ with SRI hashes", () => {
    const root = dir();
    release(root);
    const entry = stageVersion(root, { now: "2026-11-28T10:00:00Z", commit: "abc1234" });

    expect(entry.id).toMatch(/^[0-9a-f]{12}$/);
    expect(Object.keys(entry.files).sort()).toEqual([
      "playerstack-hls.js",
      "playerstack-hls.js.LEGAL.txt",
      "playerstack.min.js",
      "playerstack.min.js.LEGAL.txt",
    ]);
    expect(entry.files["playerstack.min.js"]).toBe(sri("main v1"));
    expect(readFileSync(join(root, `v/${entry.id}/playerstack.min.js`), "utf8")).toBe("main v1");
    expect(existsSync(join(root, `v/${entry.id}/demo.mp4`))).toBe(false);
    expect(manifest(root)).toEqual({ latest: entry.id, versions: [entry] });
    expect(entry).toMatchObject({ published: "2026-11-28T10:00:00Z", commit: "abc1234" });
  });

  it("keeps the id when only non-release files change and changes it with the bundle", () => {
    const a = dir();
    const b = dir();
    const c = dir();
    release(a);
    release(b);
    writeFileSync(join(b, "demo.mp4"), "other media");
    release(c, "main v2");
    const now = { now: "2026-11-28T10:00:00Z" };
    expect(stageVersion(a, now).id).toBe(stageVersion(b, now).id);
    expect(stageVersion(c, now).id).not.toBe(stageVersion(a, now).id);
  });

  it("replaces versions left by an earlier local build", () => {
    const root = dir();
    mkdirSync(join(root, "v/0123456789ab"), { recursive: true });
    release(root);
    stageVersion(root, { now: "2026-11-28T10:00:00Z" });
    expect(existsSync(join(root, "v/0123456789ab"))).toBe(false);
  });

  it("refuses a directory without the main script", () => {
    expect(() => stageVersion(dir(), { now: "2026-11-28T10:00:00Z" })).toThrow(
      /playerstack\.min\.js/,
    );
  });
});

describe("carryVersions", () => {
  function published(): { files: Record<string, string>; old: VersionManifest["versions"][0] } {
    const old = {
      id: "0123456789ab",
      published: "2026-11-01T00:00:00Z",
      files: { "playerstack.min.js": sri("old main"), "playerstack-hls.js": sri("old hls") },
    };
    return {
      old,
      files: {
        "/v/versions.json": JSON.stringify({ latest: old.id, versions: [old] }),
        "/v/0123456789ab/playerstack.min.js": "old main",
        "/v/0123456789ab/playerstack-hls.js": "old hls",
      },
    };
  }

  it("adds published versions to the build and lists the new version first", async () => {
    const dist = dir();
    release(dist);
    const current = stageVersion(dist, { now: "2026-11-28T10:00:00Z" });
    const { files, old } = published();

    await carryVersions(dist, "https://example.test", server(files));

    expect(readFileSync(join(dist, "v/0123456789ab/playerstack-hls.js"), "utf8")).toBe("old hls");
    expect(manifest(dist)).toEqual({ latest: current.id, versions: [current, old] });
  });

  it("keeps the first publication date when the bundle did not change", async () => {
    const dist = dir();
    release(dist);
    const current = stageVersion(dist, { now: "2026-11-28T10:00:00Z" });
    const live = { ...current, published: "2026-11-20T00:00:00Z" };
    const files = { "/v/versions.json": JSON.stringify({ latest: live.id, versions: [live] }) };

    await carryVersions(dist, "https://example.test", server(files));

    expect(manifest(dist)).toEqual({ latest: current.id, versions: [live] });
  });

  it("starts the history when the site has no manifest yet", async () => {
    const dist = dir();
    release(dist);
    const current = stageVersion(dist, { now: "2026-11-28T10:00:00Z" });
    await carryVersions(dist, "https://example.test", server({}));
    expect(manifest(dist)).toEqual({ latest: current.id, versions: [current] });
  });

  it("fails instead of dropping history when the manifest cannot be read", async () => {
    const dist = dir();
    release(dist);
    stageVersion(dist, { now: "2026-11-28T10:00:00Z" });
    const broken = (async () => new Response("oops", { status: 503 })) as typeof fetch;
    await expect(carryVersions(dist, "https://example.test", broken)).rejects.toThrow(/503/);
  });

  it("fails when a published file does not match its integrity hash", async () => {
    const dist = dir();
    release(dist);
    stageVersion(dist, { now: "2026-11-28T10:00:00Z" });
    const { files } = published();
    files["/v/0123456789ab/playerstack-hls.js"] = "tampered";
    await expect(carryVersions(dist, "https://example.test", server(files))).rejects.toThrow(
      /integrity/,
    );
  });

  it.each([
    ["an id outside the content-id format", "../../etc", "playerstack.min.js"],
    ["a file name outside the release", "0123456789ab", "../index.html"],
  ])("rejects a manifest with %s", async (_label, id, name) => {
    const dist = dir();
    release(dist);
    stageVersion(dist, { now: "2026-11-28T10:00:00Z" });
    const bad = { id, published: "2026-11-01T00:00:00Z", files: { [name]: sri("x") } };
    const files = { "/v/versions.json": JSON.stringify({ latest: id, versions: [bad] }) };
    await expect(carryVersions(dist, "https://example.test", server(files))).rejects.toThrow(
      /manifest/,
    );
  });
});
