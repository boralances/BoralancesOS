#!/usr/bin/env bash
# Low-copy image build: keep one store output and export it only after success.
set -euo pipefail
source_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
build_directory=${BORALANCES_BUILD_DIRECTORY:-/var/lib/boralances-build}
mkdir -p "$build_directory" "$build_directory/tmp"
cd "$source_directory"
test -s flake.lock
free_bytes=$(df --output=avail -B1 "$build_directory" | tail -n1 | tr -d ' ')
if (( free_bytes < 14000000000 )); then
  echo 'The V1 image build needs at least 14 GB of free Linux build space.' >&2
  exit 2
fi
# End the evaluator before the image builder starts. Keeping the module graph
# alive through compression wastes several GiB on a small build VM.
derivation=$(nix eval --raw --no-update-lock-file "path:$source_directory#installer-iso.drvPath")
nix build "$derivation^out" \
  --out-link "$build_directory/v1-iso" --print-build-logs \
  --max-jobs 1 --cores 2 --option build-dir "$build_directory/tmp"
image=$(find -L "$build_directory/v1-iso/iso" -maxdepth 1 -name '*.iso' -type f -print -quit)
test -n "$image"
sha256sum "$image" > "$build_directory/V1-ISO-SHA256SUMS"
printf '%s\n' "$image" > "$build_directory/v1-iso-path.txt"
echo 'V1_ISO_BUILD_COMPLETE'
