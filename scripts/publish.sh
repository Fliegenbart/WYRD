#!/bin/bash
# WYRD — Publish all packages to npm
#
# Usage:
#   ./scripts/publish.sh          # dry run
#   ./scripts/publish.sh --real   # actual publish
#
# Prerequisites:
#   npm login (must be logged in)
#   pnpm build (must be built)

set -e

DRY_RUN="--dry-run"
if [ "$1" = "--real" ]; then
  DRY_RUN=""
  echo "🚀 REAL PUBLISH MODE"
else
  echo "🧪 DRY RUN MODE (pass --real to publish for real)"
fi

VERSION="0.1.0"

# Publish order matters — dependencies first
PACKAGES=(
  "protocol"
  "identity"
  "transport"
  "reputation"
  "sdk"
  "registry"
)

echo ""
echo "Publishing @wyrd packages v${VERSION}..."
echo ""

for pkg in "${PACKAGES[@]}"; do
  dir="packages/$pkg"
  echo "📦 @wyrd/$pkg"

  # Build before publish
  pnpm --filter "@wyrd/$pkg" build > /dev/null 2>&1

  # Publish
  cd "$dir"
  npm publish $DRY_RUN 2>&1 | grep -E "npm notice|dry-run|published" || true
  cd ../..

  echo ""
done

# CLI tool
echo "📦 create-wyrd"
cd packages/cli
pnpm build > /dev/null 2>&1
npm publish $DRY_RUN 2>&1 | grep -E "npm notice|dry-run|published" || true
cd ../..

echo ""
if [ -z "$DRY_RUN" ]; then
  echo "✅ All packages published!"
else
  echo "✅ Dry run complete. Run with --real to publish."
fi
