#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if [[ $(uname -s) != Linux ]]; then
  echo 'Build inside x86_64 Linux with Nix. Windows: use a Linux VM or WSL2.' >&2
  exit 2
fi
command -v nix >/dev/null || { echo 'Install Nix with flakes support first.' >&2; exit 2; }
[[ -f flake.lock ]] || { echo 'Run nix flake lock once, review it, and commit flake.lock before building.' >&2; exit 2; }
target=${1:-installer-iso}
case "$target" in
  all) targets=(installer-iso live-iso persistent-iso usb-image virtualbox-image) ;;
  installer-iso|live-iso|persistent-iso|usb-image|virtualbox-image|browser|launcher) targets=("$target") ;;
  *) echo 'Usage: bash scripts/build.sh [installer-iso|live-iso|persistent-iso|usb-image|virtualbox-image|browser|launcher|all]' >&2; exit 2 ;;
esac
# CI validates configurations separately. Free evaluation memory before building.
# Keep release output separate from personal VM disks under out/VirtualBox.
build_output="out/build/$target"
mkdir -p "$build_output"
cp flake.lock "$build_output/flake.lock"
for item in "${targets[@]}"; do
  derivation=$(nix eval --raw --no-update-lock-file ".#packages.x86_64-linux.$item.drvPath")
  nix build "$derivation^out" --out-link "result-$item" --print-build-logs --max-jobs 1 --cores 2
  mkdir -p "$build_output/$item"
  cp -aL -- "result-$item/." "$build_output/$item/"
done
find "$build_output" -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > "$build_output/SHA256SUMS"
echo "Build artifacts and SHA256SUMS are in $build_output/."
