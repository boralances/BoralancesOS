{ config, lib, pkgs, ... }: let
  terminal = pkgs.writeShellScriptBin "alacritty" ''
    if [ "$(${pkgs.systemd}/bin/systemd-detect-virt)" = oracle ]; then
      export LIBGL_ALWAYS_SOFTWARE="''${LIBGL_ALWAYS_SOFTWARE:-1}"
      export LP_NUM_THREADS="''${LP_NUM_THREADS:-2}"
    fi
    exec ${pkgs.alacritty}/bin/alacritty "$@"
  '';
  mixer = pkgs.writeShellScriptBin "pavucontrol" ''
    if [ "$(${pkgs.systemd}/bin/systemd-detect-virt)" = oracle ]; then
      export GSK_RENDERER="''${GSK_RENDERER:-cairo}"
    fi
    exec ${pkgs.pavucontrol}/bin/pavucontrol "$@"
  '';
in {
  config = lib.mkIf config.boralances.virtualbox.enable {
    # The 6.18 vmwgfx path stalls on this host during accelerated cold boots.
    # Keep the guest on the conservative LTS driver; native builds retain their kernel choice.
    boot.kernelPackages = lib.mkForce pkgs.linuxPackages_6_12;
    # VMSVGA can reject GPU-backed Wayland buffers. Restrict this fallback to
    # the terminal in Oracle guests; explicit renderer choices take precedence.
    environment.systemPackages = [ (lib.hiPrio terminal) (lib.hiPrio mixer) ];
    virtualisation.virtualbox.guest = {
      enable = true;
      use3rdPartyModules = false;
      clipboard = true;
      dragAndDrop = false;
      seamless = false;
    };
    boot.initrd.availableKernelModules = [ "ata_piix" "vmwgfx" "vboxguest" "virtio_gpu" ];
    # This VirtualBox host drops wakeups during paravirtual spinlock / expedited
    # RCU waits. Use the conservative xAPIC path in the VM, keeping native kernels
    # unchanged. Verify the absence of RCU stalls after boot, not just unit health.
    boot.kernelParams = [ "nox2apic" "nopvspin" "rcupdate.rcu_normal=1" ];
    # Avoid systemd's @ argv[0] override consuming VBoxClient's --foreground flag.
    systemd.user.services.virtualboxClientVmsvga.serviceConfig.ExecStart = lib.mkForce
      "${config.virtualisation.virtualbox.guest.package}/bin/VBoxClient --foreground --vmsvga-session";
    systemd.user.services.virtualboxClientClipboard.serviceConfig.ExecStart = lib.mkForce
      "${config.virtualisation.virtualbox.guest.package}/bin/VBoxClient --foreground --clipboard";
  };
}
