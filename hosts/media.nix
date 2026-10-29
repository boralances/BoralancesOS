{ lib, pkgs, modulesPath, source, ... }: {
  imports = [ (modulesPath + "/installer/cd-dvd/installation-cd-minimal.nix") ];
  boot.loader.systemd-boot.enable = lib.mkForce false;
  boot.loader.timeout = lib.mkForce 8;
  boot.initrd.systemd.enable = lib.mkForce false;
  boot.zfs.forceImportRoot = false;
  isoImage = {
    makeEfiBootable = true;
    makeUsbBootable = true;
    makeBiosBootable = true;
    volumeID = "BORALANCES_V1";
    appendToMenuLabel = " — V1 Live / Install (VirtualBox / compatibility)";
    squashfsCompression = "zstd -Xcompression-level 6";
  };
  # The ISO module includes specialisation kernels, initrds and menu entries in
  # both GRUB and Syslinux. Common application closures are stored only once.
  specialisation.native-amd-intel.configuration = {
    boralances.virtualbox.enable = lib.mkForce false;
    boralances.kernel = lib.mkForce "modern";
    boot.initrd.availableKernelModules = [ "amdgpu" "i915" "xe" ];
    isoImage.appendToMenuLabel = lib.mkForce " — V1 Native AMD / Intel";
  };
  specialisation.native-nvidia.configuration = { config, ... }: {
    boralances.virtualbox.enable = lib.mkForce false;
    boralances.kernel = lib.mkForce "modern";
    services.xserver.videoDrivers = [ "modesetting" "nvidia" ];
    hardware.nvidia = {
      open = true;
      nvidiaSettings = true;
      modesetting.enable = true;
      package = config.boot.kernelPackages.nvidiaPackages.stable;
    };
    boot.initrd.kernelModules = [ "nvidia" "nvidia_modeset" "nvidia_drm" ];
    isoImage.appendToMenuLabel = lib.mkForce " — V1 Native NVIDIA (GTX 16 / RTX 20 or newer)";
  };
  users.users.nixos.extraGroups = [ "video" "audio" "networkmanager" "gamemode" "vboxsf" ];
  services.greetd.settings.initial_session = lib.mkForce { command = "uwsm start -F -D Hyprland boralances-desktop"; user = "nixos"; };
  environment.etc."boralances/source".source = source;
  environment.systemPackages = [ pkgs.mkpasswd (pkgs.writeShellScriptBin "boralances-install" ''
    exec ${pkgs.bash}/bin/bash /etc/boralances/source/scripts/install.sh "$@"
  '') (pkgs.makeDesktopItem {
    name = "boralances-installer";
    desktopName = "Install BoralancesOS";
    exec = "boralances-installer";
    icon = "boralances-installer";
    categories = [ "System" ];
  }) ];
  networking.firewall.enable = lib.mkForce true;
  services.openssh.enable = lib.mkForce false;
  # Passwordless sudo and desktop autologin are for live media only.
  security.sudo.wheelNeedsPassword = lib.mkForce false;
}
