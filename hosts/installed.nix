{ config, lib, ... }: {
  imports = [ ./enrollment.nix ];
  # Administration uses bora + sudo; image installation never leaves root blank.
  users.users.root.hashedPassword = "!";
  fileSystems."/boot".options = lib.mkAfter [ "umask=0077" ];
  # Imported by the installer AFTER hardware-configuration.nix is generated.
  boot.loader.efi.canTouchEfiVariables = true;
  users.users.${config.boralances.userName} = {
    isNormalUser = true;
    description = config.boralances.fullName;
    extraGroups = [ "wheel" "networkmanager" "video" "audio" "gamemode" "vboxsf" ];
    # No reusable password. Set this account's password before the first reboot.
  };
}
