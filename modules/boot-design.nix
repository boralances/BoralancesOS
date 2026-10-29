{ config, lib, pkgs, ... }: {
  boot.plymouth = {
    enable = true;
    theme = "boralances";
    themePackages = [ (pkgs.callPackage ../packages/plymouth.nix { }) ];
  };
  boot.consoleLogLevel = 0;
  boot.initrd.verbose = false;
  boot.kernelParams = [ "splash" "systemd.show_status=false" "rd.systemd.show_status=false"
    "udev.log_level=3" "rd.udev.log_level=3" "vt.global_cursor_default=0" ];
  # Escape in Plymouth reveals diagnostics. No artificial delay is added.
}
