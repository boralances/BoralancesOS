{ lib, ... }: {
  imports = [ ./base.nix ./desktop.nix ./gaming.nix ./compatibility.nix ./guests.nix ./boot-design.nix ./hardware-tools.nix ];
  options.boralances = {
    gaming.enable = lib.mkOption { type = lib.types.bool; default = true; };
    virtualbox.enable = lib.mkOption { type = lib.types.bool; default = true; };
    kernel = lib.mkOption { type = lib.types.enum [ "modern" "zen" "lts" ]; default = "modern"; };
    appearance = lib.mkOption { type = lib.types.enum [ "dark" "light" "system" ]; default = "dark"; };
    effects = lib.mkOption { type = lib.types.enum [ "glass" "balanced" "performance" "reduced-motion" ]; default = "performance"; };
    userName = lib.mkOption { type = lib.types.strMatching "[a-z_][a-z0-9_-]{0,30}"; default = "bora"; };
    fullName = lib.mkOption { type = lib.types.str; default = "Bora"; };
  };
}
