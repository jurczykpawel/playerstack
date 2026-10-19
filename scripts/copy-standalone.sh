#!/usr/bin/env bash
# Copy the standalone script and its lazily loaded provider files into a
# static site directory. They must stay side by side: playerstack.min.js
# fetches playerstack-<provider>.<hash>.js from its own URL's directory.
# Usage: bash scripts/copy-standalone.sh <target-dir>
set -euo pipefail

target="${1:?usage: copy-standalone.sh <target-dir>}"
dist="$(cd "$(dirname "$0")/../packages/embed/dist" && pwd)"

rm -f "$target"/playerstack*.js "$target"/playerstack*.js.LEGAL.txt
cp "$dist"/playerstack.min.js "$dist"/playerstack-*.js "$target"/
for legal in "$dist"/playerstack.min.js.LEGAL.txt "$dist"/playerstack-*.js.LEGAL.txt; do
  [ -e "$legal" ] && cp "$legal" "$target"/
done
ls "$target"/playerstack*.js
