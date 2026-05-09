# Publishing Playerstack

Step-by-step manual for going from local repo → public GitHub + npm → live docs site.

> Most of this is one-time setup. Re-running publish only needs the npm steps in section 4.

## Prerequisites

```sh
# Authenticated tools
gh auth status            # GitHub CLI logged in
npm whoami                # npm logged in (run `npm login` if not)
bun --version             # 1.3+
```

If `npm whoami` fails:

```sh
npm login
# Use an account with publish rights to the @playerstack scope.
# To create the scope: https://www.npmjs.com/org/create — pick "free" org
```

---

## 1. Create the GitHub repo (private first)

```sh
cd /Users/pavvel/workspace/projects/playerstack

gh repo create jurczykpawel/playerstack \
  --private \
  --source=. \
  --description "Embeddable video player. One script tag. YouTube, Vimeo, MP4, HLS. Plugin-first. MIT." \
  --homepage https://playerstack.sellf.app \
  --push
```

This creates the repo, sets it as `origin`, and pushes `main` + `v0.1.0` tag.

## 2. Configure repo settings

```sh
# Topics for discoverability
gh repo edit jurczykpawel/playerstack \
  --add-topic video \
  --add-topic player \
  --add-topic embed \
  --add-topic youtube \
  --add-topic vimeo \
  --add-topic vidstack \
  --add-topic web-components \
  --add-topic typescript \
  --add-topic bun \
  --add-topic oss

# Repo defaults
gh api repos/jurczykpawel/playerstack -X PATCH \
  -f delete_branch_on_merge=true \
  -f has_wiki=false \
  -f has_projects=false \
  -f allow_squash_merge=true \
  -f allow_merge_commit=false \
  -f allow_rebase_merge=false \
  -f squash_merge_commit_title=PR_TITLE

# Vulnerability alerts (Dependabot will pick this up)
gh api repos/jurczykpawel/playerstack/vulnerability-alerts -X PUT
gh api repos/jurczykpawel/playerstack/automated-security-fixes -X PUT
```

## 3. Wait for CI to pass on the private repo

```sh
gh run watch
```

Don't proceed to npm publish until CI is green. Common first-push failures:

- Playwright browser download — already in CI workflow, just slow
- Lockfile mismatch — re-run `bun install` locally and commit `bun.lock`

## 4. Publish to npm

The standalone bundle depends on all 6 plugins, which depend on `@playerstack/core`. Publish in dependency order:

```sh
# Build first (so dist/ is fresh)
bun run --cwd packages/embed build

# Set every package version (one-time bump)
# Use a script to bump consistently — manual this once for v0.1.0:
for d in packages/core packages/plugin-* packages/embed; do
  (cd "$d" && npm pkg set version=0.1.0)
done

# Publish core first
(cd packages/core && bun publish --access public)

# All plugins (independent of each other; can be in any order)
for d in packages/plugin-sources packages/plugin-controls-policy packages/plugin-autopreview packages/plugin-branded-thumb packages/plugin-cta-end packages/plugin-sellf-adapter; do
  (cd "$d" && bun publish --access public)
done

# Standalone bundle last (depends on plugins)
(cd packages/embed && bun publish --access public)
```

If you hit `403 Forbidden`:

- The `@playerstack` org doesn't exist yet — create it at https://www.npmjs.com/org/create (free tier)
- Or add `--access public` (already in the commands above) for scoped packages

## 5. Make the GitHub repo public

After CI is green and npm publish is done:

```sh
gh repo edit jurczykpawel/playerstack \
  --visibility public \
  --accept-visibility-change-consequences
```

GitHub auto-enables on going public:

- Secret scanning
- Push protection

## 6. Create the v0.1.0 GitHub release

````sh
gh release create v0.1.0 \
  --title "v0.1.0 — initial release" \
  --notes-file <(cat <<'EOF'
First public release of Playerstack.

## Highlights

- Drop-in `<player-stack>` web component, one script tag
- 5 MVP plugins bundled: sources, controls-policy, autopreview, branded-thumb, cta-end
- 1 opt-in plugin: sellf-adapter
- 139 unit tests + 4 Playwright E2E, all green
- Docs at https://playerstack.sellf.app

## Quickstart

```html
<script src="https://cdn.jsdelivr.net/npm/playerstack@0.1.0/dist/playerstack.min.js" defer></script>
<player-stack src="https://youtu.be/dQw4w9WgXcQ"></player-stack>
````

## Install (scoped)

```
npm install @playerstack/core @playerstack/plugin-sources @playerstack/plugin-cta-end
```

## What's next

- Bundle slimming toward the 50 KB target (Vidstack treeshaking, lazy plugins)
- More plugins: chapters, playlist, sticky, ab-test, analytics
- Sellf full migration (replacing the React player in admin-panel)
  EOF
  )

````

## 7. Deploy the docs site

`apps/docs` is an Astro static site. Two options:

### Option A: Cloudflare Pages

```sh
cd apps/docs
bun x wrangler pages deploy dist --project-name=playerstack-docs
````

Then in Cloudflare dashboard, add custom domain `playerstack.sellf.app` (DNS A record on `sellf.app` zone is auto-created via Cloudflare integration).

### Option B: Mikrus + Caddy (matches reelstack.sellf.app pattern)

```sh
# Build locally
bun run --cwd apps/docs build

# Sync via existing stackpilot deploy pattern — see workspace docs:
# vault/brands/_shared/infra/mikrus-infrastruktura.md
# Add a Caddy block for playerstack.sellf.app pointing to the upload dir
```

## 8. Add CI badge target

The README badges already point to `jurczykpawel/playerstack`. If you fork or rename, update the badge URLs in `README.md` lines 3-6.

## 9. Future releases

Subsequent releases follow the same pattern:

```sh
# 1. Bump versions across all packages
for d in packages/core packages/plugin-* packages/embed; do
  (cd "$d" && npm pkg set version=0.2.0)
done

# 2. Update CHANGELOG.md
# 3. Build, commit, tag, push
git add -A && git commit -m "release: v0.2.0"
git tag -a v0.2.0 -m "v0.2.0"
git push origin main v0.2.0

# 4. Wait for CI
gh run watch

# 5. Publish (use scripts/release.sh — see below)
bash scripts/release.sh

# 6. GitHub release
gh release create v0.2.0 --title "v0.2.0" --generate-notes
```

See `scripts/release.sh` for the automated publish flow.

## Troubleshooting

| Problem                                         | Cause                                  | Fix                                                                                                   |
| ----------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm publish` fails with `402 Payment Required` | Trying to publish unscoped private     | Use `--access public` or add `"publishConfig": { "access": "public" }` to package.json                |
| `npm publish` fails with `404 Not Found`        | npm scope `@playerstack` doesn't exist | Create at npmjs.com/org/create                                                                        |
| GitHub release fails with `tag already exists`  | You're re-running step 6               | Delete the tag or use `gh release create v0.1.1 --target main`                                        |
| Cloudflare Pages 404 on `/docs/plugins/sources` | trailing-slash mismatch                | Astro outputs `/docs/plugins/sources/index.html` — should work; check Cloudflare URL rewrite settings |
| Playwright E2E fails in CI but passes locally   | Different browser version              | Pin in `playwright.config.ts` `use.browserName` and re-run `bunx playwright install`                  |
