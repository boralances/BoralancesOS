{ lib, ... }: {
  imports = [ ./installed.nix ../hardware-configuration.local.nix ../installer-preferences.nix ]
    ++ lib.optional (builtins.pathExists ../drivers.local.nix) ../drivers.local.nix;
}
