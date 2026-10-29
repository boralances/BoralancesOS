{ config, lib, pkgs, ... }: let
  browser = pkgs.callPackage ../packages/browser.nix { };
  launcher = pkgs.callPackage ../packages/launcher.nix { };
  identity = pkgs.callPackage ../packages/identity.nix { };
  applicationPath = "/run/wrappers/bin:%h/.local/bin:%h/.local/share/flatpak/exports/bin:/var/lib/flatpak/exports/bin:%h/.nix-profile/bin:/nix/profile/bin:%h/.local/state/nix/profile/bin:/etc/profiles/per-user/%u/bin:/nix/var/nix/profiles/default/bin:/run/current-system/sw/bin";
  desktopSession = pkgs.writeShellScriptBin "boralances-desktop" ''
    # UWSM supervises this process and receives its readiness notification.
    export XDG_DATA_DIRS="$HOME/.local/share:$HOME/.nix-profile/share:/etc/profiles/per-user/$USER/share:/run/current-system/sw/share:/var/lib/flatpak/exports/share:$HOME/.local/share/flatpak/exports/share"
    # VMSVGA rejects Xwayland's accelerated Wayland buffers in Oracle guests.
    # Use its shared-memory backend there; keep native GPU systems unchanged.
    if [ "$(${pkgs.systemd}/bin/systemd-detect-virt)" = oracle ]; then
      export XWAYLAND_NO_GLAMOR="''${XWAYLAND_NO_GLAMOR:-1}"
      # vmwgfx atomic mode tests reject larger modes on this VirtualBox stack.
      # Restrict the legacy KMS fallback to Oracle; allow an explicit override.
      export AQ_NO_ATOMIC="''${AQ_NO_ATOMIC:-1}"
      export BORALANCES_VM_DISPLAY="''${BORALANCES_VM_DISPLAY:-1280x800@60}"
    fi
    exec Hyprland --config /etc/xdg/hypr/hyprland.lua
  '';
  loginSession = pkgs.writeShellScriptBin "boralances-login" ''
    export GSK_RENDERER=cairo GTK_USE_PORTAL=0 GDK_DEBUG=no-portals
    export XCURSOR_THEME=Adwaita XCURSOR_SIZE=28 WLR_NO_HARDWARE_CURSORS=1
    if [ "$(${pkgs.systemd}/bin/systemd-detect-virt)" = oracle ]; then
      export WLR_RENDERER=pixman WLR_DRM_NO_ATOMIC=1 LIBSEAT_BACKEND=logind
    fi
    export XDG_DATA_DIRS="${sessionEntry}/share:${pkgs.adwaita-icon-theme}/share"
    exec ${pkgs.dbus}/bin/dbus-run-session ${pkgs.cage}/bin/cage -s -d -- ${pkgs.regreet}/bin/regreet
  '';
  sessionEntry = pkgs.writeTextDir "share/wayland-sessions/boralances.desktop" ''
    [Desktop Entry]
    Name=BoralancesOS
    Comment=Liquid Glass desktop
    Exec=systemd-cat --identifier=boralances-session uwsm start -F -D Hyprland boralances-desktop
    Type=Application
    DesktopNames=Hyprland
  '';
  terminal = pkgs.writeShellScriptBin "boralances-terminal" ''
    if [ "$(${pkgs.systemd}/bin/systemd-detect-virt)" = oracle ]; then
      exec ${pkgs.foot}/bin/foot --config /etc/xdg/foot/foot.ini --app-id boralances-terminal --title Terminal "$@"
    fi
    exec ${pkgs.alacritty}/bin/alacritty "$@"
  '';
  python = pkgs.python3.withPackages (p: [ p.pyside6 ]);
  control = pkgs.writeShellApplication {
    name = "boralances-control";
    runtimeInputs = with pkgs; [ python3 hyprland rofi jq coreutils procps libnotify
      brightnessctl wireplumber wl-clipboard grim slurp swappy util-linux glib
      systemd nwg-dock-hyprland waybar swaybg dunst hypridle ];
    text = ''
      export GSETTINGS_SCHEMA_DIR="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}/glib-2.0/schemas"
      exec python3 ${../scripts/control.py} "$@"
    '';
  };
  session = pkgs.writeShellApplication {
    name = "boralances-session";
    runtimeInputs = with pkgs; [ systemd coreutils util-linux swaybg waybar dunst hypridle
      nwg-dock-hyprland hyprpolkitagent ];
    text = builtins.readFile ../scripts/session.sh;
  };
  suite = pkgs.stdenvNoCC.mkDerivation {
    pname = "boralances-companions";
    version = "0.1.0";
    src = ../apps/companions;
    nativeBuildInputs = [ pkgs.makeWrapper pkgs.qt6.wrapQtAppsHook ];
    buildInputs = [ pkgs.qt6.qtwayland pkgs.qt6.qtsvg ];
    dontWrapQtApps = true;
    installPhase = ''
      mkdir -p $out/share/boralances-companions $out/bin
      cp -r . $out/share/boralances-companions/
      for name in jarvis glass-connect overview-ui control-center quick-settings calendar system-menu start-menu center file-menu go-menu window-switcher workspaces shortcuts welcome installer gpu-center nvidia-center devices audio-center; do
        makeWrapper ${python}/bin/python $out/bin/boralances-$name \
          --add-flags "$out/share/boralances-companions/main.py $name" \
          --prefix PATH : ${lib.makeBinPath [ pkgs.scrcpy pkgs.android-tools pkgs.wireplumber pkgs.playerctl pkgs.libnotify pkgs.xdg-utils pkgs.coreutils pkgs.nwg-displays pkgs.networkmanager pkgs.bluez pkgs.dunst pkgs.brightnessctl pkgs.systemd pkgs.glib pkgs.pulseaudio pkgs.pciutils pkgs.usbutils pkgs.util-linux ]}
      done
    '';
    preFixup = ''
      for program in $out/bin/*; do wrapProgram "$program" "''${qtWrapperArgs[@]}"; done
    '';
  };
  desktop = name: title: exec: icon: pkgs.makeDesktopItem {
    inherit name exec icon;
    desktopName = title;
    categories = [ "Utility" ];
  };
in {
  imports = [ ./experience.nix ];
  programs.hyprland = { enable = true; withUWSM = true; xwayland.enable = true; };
  services.greetd = {
    enable = true;
    settings.default_session = {
      command = "${loginSession}/bin/boralances-login";
      user = "greeter";
    };
    settings.terminal.vt = 1;
  };
  programs.regreet = {
    enable = true;
    font = { package = pkgs.inter; name = "Inter"; size = 13; };
    extraCss = builtins.readFile ../config/login.css;
    settings = {
      skip_selection = true;
      GTK.application_prefer_dark_theme = true;
      appearance.greeting_msg = "Welcome to BoralancesOS";
      widget.clock = { format = "%A, %d %B\n%H:%M"; resolution = "1s"; };
    };
  };
  security.pam.services.greetd.enableGnomeKeyring = true;
  systemd.user.services.boralances-menu-bar = {
    description = "BoralancesOS menu bar";
    partOf = [ "graphical-session.target" ];
    after = [ "graphical-session-pre.target" ];
    environment.PATH = lib.mkForce applicationPath;
    serviceConfig = { ExecStart = "${control}/bin/boralances-control bar-run"; Restart = "on-failure"; RestartSec = 2; TimeoutStopSec = 5; };
  };
  systemd.user.services.boralances-dock = {
    description = "BoralancesOS application dock";
    partOf = [ "graphical-session.target" ];
    after = [ "graphical-session-pre.target" ];
    environment.PATH = lib.mkForce applicationPath;
    serviceConfig = { ExecStart = "${control}/bin/boralances-control dock-run"; Restart = "on-failure"; RestartSec = 2; TimeoutStopSec = 5; };
  };
  systemd.user.services.boralances-wallpaper = {
    description = "BoralancesOS static wallpaper";
    partOf = [ "graphical-session.target" ];
    after = [ "graphical-session-pre.target" ];
    environment.PATH = lib.mkForce applicationPath;
    serviceConfig = { ExecStart = "${control}/bin/boralances-control wallpaper-run"; Restart = "on-failure"; RestartSec = 2; TimeoutStopSec = 5; };
  };
  systemd.user.services.boralances-idle = {
    description = "BoralancesOS idle lock";
    partOf = [ "graphical-session.target" ];
    after = [ "graphical-session-pre.target" ];
    environment.PATH = lib.mkForce applicationPath;
    serviceConfig = {
      ExecCondition = pkgs.writeShellScript "boralances-native-idle-only" ''
        test "$(${pkgs.systemd}/bin/systemd-detect-virt)" != oracle
      '';
      ExecStart = "${pkgs.hypridle}/bin/hypridle";
      Restart = "on-failure"; RestartSec = 2; TimeoutStopSec = 5;
    };
  };
  security.pam.services.hyprlock = { };
  services.pipewire = { enable = true; alsa.enable = true; alsa.support32Bit = true; pulse.enable = true; wireplumber.enable = true; };
  xdg.portal.extraPortals = [ pkgs.xdg-desktop-portal-gtk ];
  environment.systemPackages = with pkgs; [ sessionEntry
    browser launcher identity desktopSession terminal control session suite foot waybar rofi dunst hyprlock hypridle swaybg
    nwg-dock-hyprland nwg-displays hyprpolkitagent thunar file-roller pavucontrol
    networkmanagerapplet wl-clipboard grim slurp swappy brightnessctl playerctl
    papirus-icon-theme adwaita-icon-theme gsettings-desktop-schemas mousepad qalculate-gtk gparted
    (desktop "boralances-jarvis" "JARVIS" "boralances-jarvis" "boralances-jarvis")
    (desktop "boralances-glass-connect" "Glass Connect" "boralances-glass-connect" "boralances-glass-connect")
    (desktop "boralances-overview" "Workspace Overview" "boralances-control overview" "view-grid-symbolic")
    (desktop "boralances-settings" "System Settings" "boralances-control-center" "boralances-settings")
    (desktop "boralances-welcome" "Welcome to BoralancesOS" "boralances-welcome" "boralances-os")
    (desktop "boralances-chat" "Boralances Chat" "boralances-browser https://boralances.boranil400.workers.dev/chat" "boralances-chat")
    (desktop "boralances-files" "Files" "thunar" "boralances-files")
    (desktop "boralances-terminal" "Terminal" "boralances-terminal" "boralances-terminal")
    (desktop "boralances-trash" "Trash" "thunar trash:///" "user-trash")
  ];
  services.gvfs.enable = true;
  fonts = {
    packages = with pkgs; [ inter nerd-fonts.jetbrains-mono noto-fonts noto-fonts-color-emoji ];
    fontconfig = {
      enable = true;
      defaultFonts = { sansSerif = [ "Inter" ]; monospace = [ "JetBrainsMono Nerd Font" ]; };
      antialias = true;
      hinting.style = "slight";
      subpixel.rgba = "none";
    };
  };
  environment.variables = { BROWSER = "boralances-browser"; TERMINAL = "boralances-terminal"; NIXOS_OZONE_WL = "1"; };
  environment.etc = {
    "xdg/hypr/hyprland.lua".source = ../config/hypr/hyprland.lua;
    "xdg/hypr/hyprlock.conf".source = ../config/hypr/hyprlock.conf;
    "xdg/hypr/hypridle.conf".source = ../config/hypr/hypridle.conf;
    "xdg/waybar/config.jsonc".source = ../config/waybar/config.jsonc;
    "xdg/waybar/style.css".source = ../config/waybar/style.css;
    "xdg/dunst/dunstrc".source = ../config/dunstrc;
    "xdg/nwg-dock-hyprland/style.css".source = ../config/dock.css;
    "xdg/alacritty/alacritty.toml".source = ../config/alacritty.toml;
    "xdg/foot/foot.ini".source = ../config/foot.ini;
    "xdg/gtk-3.0/settings.ini".source = ../config/gtk-settings.ini;
    "xdg/gtk-4.0/settings.ini".source = ../config/gtk-settings.ini;
    "xdg/rofi/config.rasi".source = ../config/rofi/config.rasi;
    "boralances/default-state.json".text = builtins.toJSON { theme = config.boralances.appearance; profile = config.boralances.effects; };
    "boralances/brand".source = ../assets/brand;
    "boralances/icons".source = ../assets/icons;
    "boralances/logo.png".source = pkgs.runCommand "boralances-logo" { nativeBuildInputs = [ pkgs.librsvg ]; } ''rsvg-convert -w 48 -h 48 ${../assets/brand/mark-white.svg} -o $out'';
    "boralances/wallpaper.svg".source = ../assets/wallpaper.svg;
    "boralances/wallpaper.png".source = pkgs.runCommand "boralances-wallpaper" { nativeBuildInputs = [ pkgs.librsvg ]; } ''rsvg-convert ${../assets/wallpaper.svg} -o $out'';
    "boralances/wallpapers/coast.png".source = pkgs.runCommand "boralances-coast" { nativeBuildInputs = [ pkgs.librsvg ]; } ''rsvg-convert ${../assets/wallpapers/coast.svg} -o $out'';
    "boralances/wallpapers/dusk.png".source = pkgs.runCommand "boralances-dusk" { nativeBuildInputs = [ pkgs.librsvg ]; } ''rsvg-convert ${../assets/wallpapers/dusk.svg} -o $out'';
    "boralances/wallpapers/graphite.png".source = pkgs.runCommand "boralances-graphite" { nativeBuildInputs = [ pkgs.librsvg ]; } ''rsvg-convert ${../assets/wallpapers/graphite.svg} -o $out'';
    "boralances/applications.json".source = ../integrations/applications.json;
  };
}
