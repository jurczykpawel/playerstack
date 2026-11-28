// Versioned copies of the standalone release under v/<id>/ for long-lived,
// SRI-pinned embeds. Cloudflare Pages publishes only what one deploy uploads,
// so the deploy job carries every version listed by the live site forward.
//
//   bun packages/embed/release-versions.ts stage <public dir>
//   bun packages/embed/release-versions.ts carry <dist dir> <site origin>
import { createHash } from "crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join } from "path";

export interface VersionEntry {
  /** First 12 hex chars of a SHA-256 over the release file names and contents. */
  id: string;
  /** When this content was first published. */
  published: string;
  commit?: string;
  /** File name -> Subresource Integrity hash (sha384). */
  files: Record<string, string>;
}

export interface VersionManifest {
  latest: string;
  /** Newest first. */
  versions: VersionEntry[];
}

const MAIN = "playerstack.min.js";
const RELEASE_FILE = /^playerstack[a-z0-9.-]*\.js(\.LEGAL\.txt)?$/;
const ID = /^[0-9a-f]{12}$/;
const SRI = /^sha384-[A-Za-z0-9+/]+={0,2}$/;

const integrity = (data: Uint8Array) =>
  `sha384-${createHash("sha384").update(data).digest("base64")}`;
const manifestPath = (root: string) => join(root, "v/versions.json");
const writeManifest = (root: string, manifest: VersionManifest) =>
  writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`);

/**
 * Copies the release files in `root` to `root/v/<id>/` and writes a manifest
 * listing only it. Replaces any earlier `root/v/`; older versions are added
 * at deploy time by `carryVersions`.
 */
export function stageVersion(root: string, meta: { now: string; commit?: string }): VersionEntry {
  const names = readdirSync(root)
    .filter((name) => RELEASE_FILE.test(name))
    .sort();
  if (!names.includes(MAIN)) throw new Error(`${MAIN} is missing in ${root}`);

  const hash = createHash("sha256");
  const files: Record<string, string> = {};
  for (const name of names) {
    const data = readFileSync(join(root, name));
    hash.update(name).update("\0").update(data).update("\0");
    files[name] = integrity(data);
  }
  const id = hash.digest("hex").slice(0, 12);
  rmSync(join(root, "v"), { recursive: true, force: true });
  mkdirSync(join(root, "v", id), { recursive: true });
  for (const name of names) copyFileSync(join(root, name), join(root, "v", id, name));

  const entry: VersionEntry = {
    id,
    published: meta.now,
    ...(meta.commit && { commit: meta.commit }),
    files,
  };
  writeManifest(root, { latest: id, versions: [entry] });
  return entry;
}

function validate(manifest: unknown): VersionManifest {
  const m = manifest as VersionManifest;
  const ok =
    Array.isArray(m?.versions) &&
    m.versions.every(
      (v) =>
        ID.test(v?.id) &&
        typeof v.published === "string" &&
        Object.entries(v.files ?? {}).every(
          ([name, hash]) => RELEASE_FILE.test(name) && SRI.test(hash),
        ),
    );
  if (!ok) throw new Error("published manifest has an unexpected shape");
  return m;
}

/**
 * Downloads every version the live site lists into `dist/v/`, verifying each
 * file against its SRI hash, and writes the merged manifest. A missing
 * manifest (404) starts the history; any other failure aborts the deploy so
 * published versions are never dropped silently.
 */
export async function carryVersions(
  dist: string,
  origin: string,
  fetchFn: typeof fetch = fetch,
): Promise<VersionManifest> {
  const current = JSON.parse(readFileSync(manifestPath(dist), "utf8")) as VersionManifest;
  const entry = current.versions[0]!;
  const res = await fetchFn(new URL("/v/versions.json", origin));
  if (res.status === 404) {
    console.warn(`[versions] ${origin} has no manifest yet; starting with ${entry.id}`);
    return current;
  }
  if (!res.ok) throw new Error(`cannot read published manifest: HTTP ${res.status}`);
  const live = validate(await res.json());

  const merged: VersionEntry[] = [];
  for (const old of live.versions) {
    if (old.id === entry.id) {
      entry.published = old.published;
      continue;
    }
    const target = join(dist, "v", old.id);
    mkdirSync(target, { recursive: true });
    for (const [name, hash] of Object.entries(old.files)) {
      const fileRes = await fetchFn(new URL(`/v/${old.id}/${name}`, origin));
      if (!fileRes.ok)
        throw new Error(`cannot download v/${old.id}/${name}: HTTP ${fileRes.status}`);
      const data = new Uint8Array(await fileRes.arrayBuffer());
      if (integrity(data) !== hash) throw new Error(`v/${old.id}/${name} fails its integrity hash`);
      if (!existsSync(join(target, name))) writeFileSync(join(target, name), data);
    }
    merged.push(old);
  }
  const manifest = { latest: entry.id, versions: [entry, ...merged] };
  writeManifest(dist, manifest);
  return manifest;
}

if (import.meta.main) {
  const [command, root, origin] = process.argv.slice(2);
  if (command === "stage" && root) {
    const entry = stageVersion(root, {
      now: new Date().toISOString(),
      commit: process.env.GITHUB_SHA?.slice(0, 7),
    });
    console.log(`[versions] staged v/${entry.id}/ (${Object.keys(entry.files).length} files)`);
  } else if (command === "carry" && root && origin) {
    const manifest = await carryVersions(root, origin);
    console.log(`[versions] ${manifest.versions.length} versions, latest v/${manifest.latest}/`);
  } else {
    console.error("usage: release-versions.ts stage <dir> | carry <dist> <origin>");
    process.exit(1);
  }
}
