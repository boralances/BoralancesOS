{ lib, ... }: {
  imports = [ ./media.nix ];
  isoImage.edition = "installer";
  image.baseName = lib.mkForce "BoralancesOS-V1-Live-Installer-x86_64";
}
