#!/usr/bin/env bash
set -euo pipefail

# Build embed bundle
cd packages/embed
bun run build
cp dist/playerstack.min.js ../../apps/docs/public/playerstack.min.js

# Build Astro docs
cd ../../apps/docs
bun run build
