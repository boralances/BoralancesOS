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
nix flake check --no-build --no-update-lock-file
mkdir -p out
cp flake.lock out/flake.lock
for item in "${targets[@]}"; do
  nix build --no-update-lock-file ".#$item" --out-link "result-$item" --print-build-logs
  mkdir -p "out/$item"
  cp -aL -- "result-$item/." "out/$item/"
done
find out -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > out/SHA256SUMS
echo 'Build artifacts and SHA256SUMS are in out/.'
