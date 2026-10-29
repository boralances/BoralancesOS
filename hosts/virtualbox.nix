{ lib, pkgs, ... }: {
  imports = [ ./portable.nix ];
  boralances.kernel = "lts";
  networking.hostName = "boralances-vbox";
  # A low effects profile is selected automatically inside an Oracle guest.
  boot.initrd.availableKernelModules = [ "ata_piix" "ahci" "sd_mod" "sr_mod" "vmwgfx" "vboxguest" ];
  environment.etc."xdg/hypr/hyprland.lua".source = lib.mkForce (pkgs.writeText "hyprland-vbox.lua"
    (builtins.replaceStrings [ "scale = \"auto\"" ] [ "scale = 1" ] (builtins.readFile ../config/hypr/hyprland.lua)));
}
