{ pkgs, ... }: let
  disks = pkgs.writeShellScriptBin "boralances-disks" ''
    if [ "$(${pkgs.systemd}/bin/systemd-detect-virt)" = oracle ]; then
      export GSK_RENDERER="''${GSK_RENDERER:-cairo}"
    fi
    exec ${pkgs.gnome-disk-utility}/bin/gnome-disks "$@"
  '';
  monitor = pkgs.writeShellScriptBin "boralances-gpu-monitor" ''
    if [ "$(${pkgs.systemd}/bin/systemd-detect-virt)" = oracle ]; then
      exec /run/current-system/sw/bin/boralances-task-manager "$@"
    fi
    exec /run/current-system/sw/bin/boralances-terminal -e ${pkgs.nvtopPackages.full}/bin/nvtop "$@"
  '';
in {
  services.udisks2.enable = true;
  environment.systemPackages = [ disks monitor pkgs.nvtopPackages.full pkgs.vulkan-tools pkgs.mesa-demos ]
    ++ (map (item: pkgs.makeDesktopItem {
      name = "boralances-" + item.name; desktopName = item.title;
      exec = "boralances-" + item.name; icon = "boralances-" + item.icon;
      categories = [ "System" "Settings" ];
    }) [
      { name="gpu-center"; title="GPU & Device Center"; icon="gpu"; }
      { name="nvidia-center"; title="NVIDIA Center"; icon="nvidia"; }
      { name="devices"; title="USB & Devices"; icon="usb"; }
      { name="audio-center"; title="Microphone & Sound"; icon="sound"; }
      { name="disks"; title="Disks"; icon="files"; }
    ]);
}
