#!/usr/bin/env bash
# Copy the standalone script and its lazily loaded provider files into a
# static site directory. They must stay side by side: playerstack.min.js
# fetches playerstack-<provider>.js?v=<hash> from its own URL's directory.
# Usage: bash scripts/copy-standalone.sh <target-dir>
set -euo pipefail

target="${1:?usage: copy-standalone.sh <target-dir>}"
dist="$(cd "$(dirname "$0")/../packages/embed/dist" && pwd)"

files=(playerstack.min.js)
for provider in youtube hls vimeo wistia twitch; do
  files+=("playerstack-${provider}.js")
done
for file in "${files[@]}"; do
  for required in "$file" "$file.LEGAL.txt"; do
    if [ ! -s "$dist/$required" ]; then
      echo "Missing standalone release file: $required" >&2
      exit 1
    fi
  done
done

mkdir -p "$target"
rm -f "$target"/playerstack*.js "$target"/playerstack*.js.LEGAL.txt
for file in "${files[@]}"; do
  cp "$dist/$file" "$dist/$file.LEGAL.txt" "$target/"
done
ls "$target"/playerstack*.js
