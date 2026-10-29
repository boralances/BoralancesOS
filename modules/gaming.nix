{ config, lib, pkgs, ... }: {
  config = lib.mkIf config.boralances.gaming.enable {
    hardware.graphics = { enable = true; enable32Bit = true; };
    hardware.steam-hardware.enable = true;
    programs.steam = { enable = true; gamescopeSession.enable = false; remotePlay.openFirewall = false; dedicatedServer.openFirewall = false; };
    programs.gamemode.enable = true;
    programs.gamescope = { enable = true; capSysNice = false; };
    environment.systemPackages = with pkgs; [ mangohud protonup-qt lutris heroic vulkan-tools
      vulkan-loader vulkan-validation-layers jdk8 jdk17 jdk21 jdk25 ];
    environment.etc."MangoHud/MangoHud.conf".source = ../config/MangoHud.conf;
    programs.gamemode.settings = {
      general = { renice = 5; inhibit_screensaver = 1; };
      custom = {
        start = "/run/current-system/sw/bin/boralances-control game-on";
        end = "/run/current-system/sw/bin/boralances-control game-off";
      };
    };
  };
}
