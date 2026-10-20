#!/usr/bin/env bash
# Copy the main script, lazy providers/plugins and notices as one release.
# Usage: bash scripts/copy-standalone.sh <target-dir>
set -euo pipefail

target="${1:?usage: copy-standalone.sh <target-dir>}"
dist="$(cd "$(dirname "$0")/../packages/embed/dist" && pwd)"

files=(playerstack.min.js)
for provider in youtube hls vimeo wistia twitch; do
  files+=("playerstack-${provider}.js")
done
for plugin in controls-policy autopreview branded-thumb email-gate saved-position action-bar chapters cta-end sticky yt-subscribe analytics watermark custom-css intro-card; do
  files+=("playerstack-plugin-${plugin}.js")
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
