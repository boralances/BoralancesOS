{ lib, pkgs, ... }: {
  imports = [ ./installed.nix ];
  fileSystems."/" = { device = "/dev/disk/by-label/BORALANCES"; fsType = "ext4"; autoResize = true; };
  fileSystems."/boot" = { device = "/dev/disk/by-label/ESP"; fsType = "vfat"; };
  boot.growPartition = true;
  boot.loader.efi.canTouchEfiVariables = lib.mkForce false;
  boot.loader.systemd-boot.graceful = true;
}
