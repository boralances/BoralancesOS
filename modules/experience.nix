{ pkgs, lib, ... }: let
  gtkPython = pkgs.python3.withPackages (p: [ p.pygobject3 ]);
  widgets = pkgs.stdenvNoCC.mkDerivation {
    pname = "boralances-widgets"; version = "0.3.0";
    dontUnpack = true;
    nativeBuildInputs = [ pkgs.makeWrapper pkgs.wrapGAppsHook3 pkgs.gobject-introspection ];
    buildInputs = [ pkgs.gtk3 pkgs.gtk-layer-shell ];
    installPhase = ''
      mkdir -p $out/bin
      makeWrapper ${gtkPython}/bin/python $out/bin/boralances-widgets --add-flags ${../apps/widgets.py} \
        --prefix PYTHONPATH : ${../apps/companions} \
        --prefix PATH : ${lib.makeBinPath [ pkgs.systemd pkgs.playerctl pkgs.wireplumber pkgs.dunst pkgs.libnotify ]}
      makeWrapper ${gtkPython}/bin/python $out/bin/boralances-dock --add-flags ${../apps/dock.py} \
        --prefix PYTHONPATH : ${../apps/companions} \
        --prefix PATH : ${lib.makeBinPath [ pkgs.systemd pkgs.glib pkgs.hyprland ]}
      makeWrapper ${gtkPython}/bin/python $out/bin/boralances-desktop-icons --add-flags ${../apps/desktop_icons.py} \
        --prefix PATH : ${lib.makeBinPath [ pkgs.systemd pkgs.glib pkgs.thunar ]}
    '';
  };
  cli = pkgs.writeShellApplication {
    name = "boralancesos";
    runtimeInputs = [ pkgs.python3 pkgs.podman pkgs.systemd pkgs.coreutils pkgs.pciutils pkgs.usbutils pkgs.xdg-utils pkgs.vulkan-tools ];
    text = ''
      export PYTHONPATH=${../apps/companions}:"''${PYTHONPATH:-}"
      exec python3 ${../apps/system_cli.py} "$@"
    '';
  };
  mediaPlayer = pkgs.mpv.override { scripts = [ pkgs.mpvScripts.mpris ]; };
  taskManager = pkgs.writeShellScriptBin "boralances-task-manager" ''
    if [ "$(${pkgs.systemd}/bin/systemd-detect-virt)" = oracle ]; then
      export GSK_RENDERER="''${GSK_RENDERER:-cairo}"
    fi
    exec ${pkgs.gnome-system-monitor}/bin/gnome-system-monitor "$@"
  '';
  torSession = pkgs.writeShellApplication {
    name = "boralances-tor-session";
    runtimeInputs = [ pkgs.tor pkgs.coreutils ];
    text = ''
      directory="''${XDG_STATE_HOME:-$HOME/.local/state}/boralances-tor"
      mkdir -p "$directory"
      chmod 700 "$directory"
      exec tor --DataDirectory "$directory" --SocksPort 127.0.0.1:9050 --ClientOnly 1 \
        --ControlSocket "$directory/control" --CookieAuthentication 1 \
        --CookieAuthFile "$directory/control.authcookie" --Log "notice stdout"
    '';
  };
in {
  environment.systemPackages = [ (pkgs.callPackage ../packages/unreal-env.nix { inherit pkgs; }) ] ++ (with pkgs; [ widgets cli taskManager evince mediaPlayer imv geany keepassxc blueman
    (makeDesktopItem { name="boralances-task-manager"; desktopName="Task Manager"; exec="boralances-task-manager"; icon="boralances-task-manager"; categories=["System" "Monitor"]; })
    (makeDesktopItem { name="boralances-calendar"; desktopName="Calendar"; exec="boralances-control calendar"; icon="boralances-calendar"; categories=["Office"]; })
    (makeDesktopItem { name="boralances-tor"; desktopName="BoralancesBrowser · Tor"; exec="boralances-browser --tor"; icon="boralances-tor"; categories=["Network" "WebBrowser"]; })
  ]) ++ (map (name: pkgs.makeDesktopItem {
    name = "boralances-" + name; desktopName = "BoralancesOS " + name;
    exec = "boralances-" + name; icon = if name == "window-switcher" then "boralances-overview" else "boralances-" + name;
    noDisplay = true; categories = [ "Utility" ];
  }) [ "quick-settings" "system-menu" "start-menu" "center" "file-menu" "go-menu" "window-switcher" "workspaces" "shortcuts" ]);
  environment.etc."boralances/version".text = "1.0.0\n";
  environment.etc."boralances/hyprbars.so".source = "${pkgs.hyprlandPlugins.hyprbars}/lib/libhyprbars.so";
  systemd.user.services.boralances-widgets = {
    description = "Optional desktop clock and system widgets";
    partOf = [ "graphical-session.target" ];
    serviceConfig = { ExecStart = "${widgets}/bin/boralances-widgets"; Restart = "on-failure"; RestartSec = 3; };
  };
  systemd.user.services.boralances-desktop-icons = {
    description = "BoralancesOS desktop files and shortcuts";
    partOf = [ "graphical-session.target" ];
    after = [ "boralances-wallpaper.service" ];
    serviceConfig = { ExecStart = "${widgets}/bin/boralances-desktop-icons"; Restart = "on-failure"; RestartSec = 3; };
  };
  systemd.user.services.boralances-tor = {
    description = "On-demand Tor routing for BoralancesBrowser";
    serviceConfig = {
      ExecStart = "${torSession}/bin/boralances-tor-session";
      Restart = "on-failure"; RestartSec = 5;
      NoNewPrivileges = true; UMask = "0077";
      TimeoutStopSec = 20;
    };
  };
}
