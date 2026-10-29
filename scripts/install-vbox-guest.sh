#!/usr/bin/env bash
# Build-time provisioning ONLY for the fresh virtual disk created by this task.
set -euo pipefail
exec > >(tee /dev/ttyS0 /run/boralances-vbox-install.log) 2>&1
echo BORALANCES_VBOX_INSTALL_START
[[ $(systemd-detect-virt) == oracle ]] || { echo 'Not a VirtualBox guest.'; exit 2; }
runuser -u nixos -- env XDG_RUNTIME_DIR=/run/user/1000 hyprctl -i 0 eval 'hl.monitor({output="",mode="preferred",position="auto",scale=1})' || true
[[ $(lsblk -dn -o SERIAL /dev/sda | tr -d '[:space:]') == BORA_BUILD_01 ]] || { echo 'Unexpected disk identity.'; exit 2; }
[[ $(lsblk -dn -o TYPE /dev/sda) == disk ]] || exit 2
[[ $(blockdev --getsize64 /dev/sda) -eq 42949672960 ]] || { echo 'Unexpected build disk size.'; exit 2; }
signatures=$(wipefs -n --noheadings --output TYPE /dev/sda)
if [[ -z "$signatures" ]]; then
  parted --script /dev/sda mklabel gpt mkpart ESP fat32 1MiB 1025MiB set 1 esp on mkpart BORALANCES ext4 1025MiB 100%
  partprobe /dev/sda
  udevadm settle
  mkfs.vfat -F 32 -n ESP /dev/sda1
  mkfs.ext4 -F -L BORALANCES /dev/sda2
else
  [[ $(blkid -s LABEL -o value /dev/sda2) == BORALANCES && $(blkid -s LABEL -o value /dev/sda1) == ESP ]] || { echo 'Refusing a disk with unknown contents.'; exit 2; }
fi
modprobe ext4
modprobe vfat
mountpoint -q /mnt || mount /dev/sda2 /mnt
if [[ -n "$signatures" && ! -f /mnt/boralances-build-incomplete ]]; then
  echo 'No matching incomplete-build marker. Refusing to replace an existing installation.'
  exit 2
fi
touch /mnt/boralances-build-incomplete
mkdir -p /mnt/boot /mnt/etc/nixos/boralances
mountpoint -q /mnt/boot || mount /dev/sda1 /mnt/boot
destination=/mnt/etc/nixos/boralances
cp -aL /etc/boralances/source/. "$destination/"
chmod -R u+w "$destination"
nixos-generate-config --root /mnt --dir "$destination"
mv "$destination/hardware-configuration.nix" "$destination/hardware-configuration.local.nix"
cat > "$destination/installer-preferences.nix" <<'EOF'
{ config, lib, pkgs, ... }: {
  boralances.kernel = "lts";
  boralances.effects = "performance";
  networking.hostName = "boralances-vbox";
  boot.loader.efi.canTouchEfiVariables = lib.mkForce false;
  boot.supportedFilesystems = [ "ext4" "vfat" "btrfs" "xfs" ];
  systemd.user.services.virtualboxClientVmsvga.serviceConfig.ExecStart = lib.mkForce
    "${config.virtualisation.virtualbox.guest.package}/bin/VBoxClient --foreground --vmsvga-session";
  systemd.user.services.virtualboxClientClipboard.serviceConfig.ExecStart = lib.mkForce
    "${config.virtualisation.virtualbox.guest.package}/bin/VBoxClient --foreground --clipboard";
  environment.etc."xdg/hypr/hyprland.lua".source = lib.mkForce (pkgs.writeText "hyprland-vbox.lua"
    (builtins.replaceStrings [ "scale = \"auto\"" ] [ "scale = 1" ] (builtins.readFile ./config/hypr/hyprland.lua)));
}
EOF
echo BORALANCES_VBOX_INSTALL_SYSTEM
nixos-install --no-root-password --flake "path:$destination#workstation"
rm /mnt/boralances-build-incomplete
echo BORALANCES_VBOX_INSTALL_DONE
sync
systemctl poweroff
