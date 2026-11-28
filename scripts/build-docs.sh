#!/usr/bin/env bash
set -euo pipefail

# Build embed bundle
cd packages/embed
bun run build
bash ../../scripts/copy-standalone.sh ../../apps/docs/public
bun release-versions.ts stage ../../apps/docs/public

# Build Astro docs
cd ../../apps/docs
bun run build
