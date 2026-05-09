#!/usr/bin/env bash
# Publish all Playerstack packages to npm in dependency order.
#
# Usage:
#   bash scripts/release.sh              # publishes whatever versions are in package.json
#   bash scripts/release.sh 0.2.0        # bumps every package to 0.2.0 first, then publishes
#
# Requires: bun, npm logged in, @playerstack scope owned by the logged-in user.

set -euo pipefail

cd "$(dirname "$0")/.."

NEW_VERSION="${1:-}"

if [ -n "$NEW_VERSION" ]; then
  echo "→ Bumping all packages to $NEW_VERSION"
  for d in packages/core packages/plugin-* packages/embed; do
    (cd "$d" && npm pkg set "version=$NEW_VERSION")
  done
fi

echo "→ Verifying npm login"
if ! npm whoami > /dev/null 2>&1; then
  echo "✗ Not logged in to npm. Run: npm login" >&2
  exit 1
fi

echo "→ Building standalone bundle"
bun run --cwd packages/embed build

echo "→ Running unit tests once before publish"
bun run test

ORDER=(
  "packages/core"
  "packages/plugin-sources"
  "packages/plugin-controls-policy"
  "packages/plugin-autopreview"
  "packages/plugin-branded-thumb"
  "packages/plugin-cta-end"
  "packages/plugin-sellf-adapter"
  "packages/embed"
)

for d in "${ORDER[@]}"; do
  pkg_name=$(node -p "require('./$d/package.json').name")
  pkg_ver=$(node -p "require('./$d/package.json').version")
  echo ""
  echo "→ Publishing $pkg_name@$pkg_ver"
  (cd "$d" && bun publish --access public)
done

echo ""
echo "✓ All packages published."
echo ""
echo "Next:"
echo "  git add -A && git commit -m \"release: v$(node -p \"require('./packages/core/package.json').version\")\""
echo "  git tag -a v$(node -p "require('./packages/core/package.json').version") -m \"v$(node -p "require('./packages/core/package.json').version")\""
echo "  git push origin main --tags"
echo "  gh release create v$(node -p "require('./packages/core/package.json').version") --generate-notes"
