#!/usr/bin/env bash
# Uses reviewed mounts, or initializes only an explicitly selected blank disk.
set -euo pipefail
root=${1:-/mnt}
mode=${2:-interactive}
expected_root=''; expected_boot=''
zone=Europe/Istanbul
theme=dark
effects=balanced
if [[ "$mode" == --gui ]]; then
  [[ $# -eq 7 ]] || { echo 'Invalid installer plan.' >&2; exit 2; }
  expected_root=$3; expected_boot=$4; zone=$5; theme=$6; effects=$7
elif [[ "$mode" != interactive ]]; then
  echo 'Unknown installer mode.' >&2; exit 2
fi
case "$zone" in Europe/Istanbul|UTC|Europe/London|Europe/Berlin|America/New_York|Asia/Tokyo) ;; *) exit 2 ;; esac
case "$theme" in dark|light|system) ;; *) exit 2 ;; esac
case "$effects" in glass|balanced|performance|reduced-motion) ;; *) exit 2 ;; esac
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 2; }
[[ "$root" == /mnt ]] || { echo 'Only /mnt is accepted as the installation target.' >&2; exit 2; }
[[ -d /sys/firmware/efi ]] || { echo 'Boot the installer in UEFI mode to install with systemd-boot.' >&2; exit 2; }
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
blank=false; disk=''
if [[ "$mode" == --gui && "$expected_root" == blank:* ]]; then
  [[ "$expected_boot" == create-efi ]] || exit 2
  blank=true; disk=${expected_root#blank:}
fi
validate_mounts() {
mountpoint -q /mnt || { echo 'Mount the destination root filesystem at /mnt first.' >&2; exit 2; }
mountpoint -q /mnt/boot || { echo 'Mount a FAT32 EFI System Partition at /mnt/boot first (1 GiB recommended).' >&2; exit 2; }
[[ $(findmnt -n -o FSTYPE -M /mnt/boot) == vfat ]] || { echo '/mnt/boot must be FAT32/vfat.' >&2; exit 2; }
root_source=$(findmnt -n -o SOURCE -M /mnt)
boot_source=$(findmnt -n -o SOURCE -M /mnt/boot)
if [[ "$mode" == --gui && "$blank" == false && ( "$root_source" != "$expected_root" || "$boot_source" != "$expected_boot" ) ]]; then
  echo 'Destination changed since review. Refresh the installation plan.' >&2; exit 2
fi
[[ "$root_source" == /dev/* && "$boot_source" == /dev/* ]] || { echo 'Destination must use real block-device filesystems.' >&2; exit 2; }
case $(findmnt -n -o FSTYPE -M /mnt) in
  ext4|btrfs|xfs) ;;
  *) echo 'Unsupported destination root filesystem.' >&2; exit 2 ;;
esac
}
if [[ "$blank" == true ]]; then
  python3 "$source_dir/apps/companions/disk_setup.py" check "$disk"
  printf 'Initialize reviewed blank disk %s with GPT, a 1 GiB EFI partition and ext4 root.\n' "$disk"
else
  validate_mounts
  printf 'Install BoralancesOS to root %s with EFI partition %s. Existing files may be replaced.\n' "$root_source" "$boot_source"
fi
read -r -p 'Type INSTALL BORALANCESOS to continue: ' answer
[[ "$answer" == 'INSTALL BORALANCESOS' ]] || exit 1
account_json=''; password_file=''
if [[ "$mode" == --gui ]]; then
  IFS= read -r account_json || { echo 'Account details were not received.' >&2; exit 2; }
else
  read -r -p 'New username [bora]: ' account_user
  account_user=${account_user:-bora}
  read -r -p 'Your name: ' account_name
  account_name=${account_name:-$account_user}
  account_json=$(python3 -c 'import json,sys;print(json.dumps({"username":sys.argv[1],"fullName":sys.argv[2]}))' "$account_user" "$account_name")
fi
printf '%s' "$account_json" | PYTHONPATH="$source_dir/apps/companions" python3 -c '
import json,sys
from account_setup import validate_account
try:validate_account(json.load(sys.stdin),sys.argv[1]=="--gui")
except (ValueError,TypeError) as error:raise SystemExit(str(error))
' "$mode"
if [[ "$blank" == true ]]; then
  echo 'BORALANCES_STAGE:partition'
  python3 "$source_dir/apps/companions/disk_setup.py" prepare "$disk"
  validate_mounts
fi

echo 'BORALANCES_STAGE:prepare'
destination=/mnt/etc/nixos/boralances
[[ ! -e "$destination" ]] || { echo "$destination already exists; preserve or rename it before retrying." >&2; exit 2; }
mkdir -p "$destination"
rsync -a --exclude=out --exclude='result*' --exclude=.git --exclude=.cache --exclude=test-output \
  --exclude=hardware-configuration.local.nix --exclude=installer-preferences.nix --exclude=drivers.local.nix --exclude=account.json \
  -- "$source_dir/" "$destination/"
nixos-generate-config --root /mnt --dir "$destination"
mv -- "$destination/hardware-configuration.nix" "$destination/hardware-configuration.local.nix"
if [[ "$mode" == --gui ]]; then
  password_file=$(printf '%s' "$account_json" | python3 "$source_dir/apps/companions/account_setup.py" "$destination")
  trap 'rm -f -- "$password_file"' EXIT
else
  printf '%s' "$account_json" | python3 "$source_dir/apps/companions/account_setup.py" "$destination" --metadata-only >/dev/null
fi
account_user=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["username"])' "$destination/account.json")
configure_graphics=$(printf '%s' "$account_json" | python3 -c 'import json,sys;print("true" if json.load(sys.stdin).get("configureGraphics",True) is True else "false")')
unset account_json
if [[ "$configure_graphics" == true ]]; then
  python3 "$source_dir/apps/companions/hardware_tools.py" prepare-install "$destination"
fi
virtualbox=false
if [[ $(systemd-detect-virt || true) == oracle ]]; then virtualbox=true; fi
cat > "$destination/installer-preferences.nix" <<EOF
{ ... }: let account = builtins.fromJSON (builtins.readFile ./account.json); in {
  time.timeZone = "$zone";
  boralances.appearance = "$theme";
  boralances.effects = "$effects";
  boralances.userName = account.username;
  boralances.fullName = account.fullName;
  boralances.virtualbox.enable = $virtualbox;
}
EOF
# A mutable local path flake avoids accidentally ignoring generated/untracked files.
if [[ ! -f "$destination/flake.lock" ]]; then nix flake lock "path:$destination"; fi
echo 'BORALANCES_STAGE:build'
nixos-install --no-root-password --flake "path:$destination#workstation"
if [[ "$mode" == interactive ]]; then
  echo 'Choose the password for your new account:'
  nixos-enter --root /mnt -c "passwd $account_user"
else
  nixos-enter --root /mnt -c 'chpasswd -e' < "$password_file"
fi
mkdir -p /mnt/var/lib/boralances
touch /mnt/var/lib/boralances/password-set
echo 'BORALANCES_STAGE:complete'
echo 'Installation complete. Remove the live media before rebooting.'
