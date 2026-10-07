#!/usr/bin/env bash
set -euo pipefail
revision="${1:-$(git rev-parse HEAD)}"
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
test -f .next/standalone/server.js
staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
cp -a .next/standalone/. "$staging/"
mkdir -p "$staging/.next" "$staging/deploy"
cp -a .next/static "$staging/.next/static"
if [ -d public ]; then cp -a public "$staging/public"; fi
cp -a scripts src "$staging/"
cp deploy/ecosystem.config.cjs "$staging/deploy/"
cp package.json package-lock.json "$staging/"
(cd "$staging" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
printf '%s\n' "$revision" > "$staging/REVISION"
mkdir -p artifacts
tar --dereference --hard-dereference -czf "artifacts/$revision.tar.gz" -C "$staging" .
