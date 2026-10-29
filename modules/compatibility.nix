{ pkgs, ... }: let
  runExe = pkgs.writeShellApplication {
    name = "boralances-exe";
    runtimeInputs = [ pkgs.wineWow64Packages.stable pkgs.coreutils ];
    text = ''
      if [[ $# -lt 1 || ! -f "$1" ]]; then echo "Usage: boralances-exe /path/to/program.exe [arguments]" >&2; exit 2; fi
      app=$(realpath -- "$1"); shift
      prefix="''${XDG_DATA_HOME:-$HOME/.local/share}/boralances/wine/default"
      mkdir -p "$prefix"
      export WINEPREFIX="$prefix"
      exec wine "$app" "$@"
    '';
  };
in {
  programs.appimage = { enable = true; binfmt = true; };
  programs.nix-ld = {
    enable = true;
    libraries = with pkgs; [ stdenv.cc.cc zlib openssl curl libGL libglvnd libpulseaudio alsa-lib
      libx11 libxcursor libxext libxi libxrandr libxrender libxtst libxxf86vm
      glfw3 openal freetype fontconfig udev ];
  };
  services.flatpak.enable = true;
  services.gnome.gnome-keyring.enable = true;
  environment.systemPackages = with pkgs; [ runExe wineWow64Packages.stable winetricks
    (makeDesktopItem {
      name = "boralances-wine"; desktopName = "Windows Application";
      exec = "boralances-exe %f"; icon = "application-x-ms-dos-executable";
      mimeTypes = [ "application/x-ms-dos-executable" "application/vnd.microsoft.portable-executable" ];
      noDisplay = true;
    })
  ];
  xdg.mime.defaultApplications = {
    "application/x-ms-dos-executable" = "boralances-wine.desktop";
    "application/vnd.microsoft.portable-executable" = "boralances-wine.desktop";
    "text/html" = "boralances-browser.desktop";
    "x-scheme-handler/http" = "boralances-browser.desktop";
    "x-scheme-handler/https" = "boralances-browser.desktop";
  };
}
