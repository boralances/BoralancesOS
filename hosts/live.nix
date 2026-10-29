{ lib, ... }: {
  imports = [ ./media.nix ];
  isoImage.edition = "live";
  image.baseName = lib.mkForce "BoralancesOS-V1-Live-x86_64";
}
