{ lib, ... }: {
  imports = [ ./media.nix ];
  image.baseName = lib.mkForce "BoralancesOS-Persistent-0.1-x86_64";
  isoImage.edition = "persistent";
  # Mandatory, external ext4 volume; missing media deliberately fails boot.
  # The ISO's lower squashfs remains read-only. All overlay writes go to USB.
  fileSystems."/nix/.rw-store" = lib.mkForce {
    device = "/dev/disk/by-label/BLPERSIST01";
    fsType = "ext4";
    neededForBoot = true;
    options = [ "noatime" ];
  };
  boot.initrd.postMountCommands = ''
    for path in home nix/var etc/NetworkManager/system-connections var/lib/NetworkManager var/lib/bluetooth var/lib/flatpak var/lib/nixos; do
      mkdir -p "/mnt-root/nix/.rw-store/state/$path" "/mnt-root/$path"
      mount --bind "/mnt-root/nix/.rw-store/state/$path" "/mnt-root/$path"
    done
    touch /mnt-root/nix/.rw-store/state/machine-id /mnt-root/etc/machine-id
    mount --bind /mnt-root/nix/.rw-store/state/machine-id /mnt-root/etc/machine-id
  '';
  services.fstrim.enable = lib.mkForce false;
  nix.gc.automatic = lib.mkForce false;
}
