{ config, lib, pkgs, ... }: {
  system.stateVersion = "26.05";
  nixpkgs.config.allowUnfree = true;
  system.nixos.distroName = "BoralancesOS";
  system.nixos.distroId = "boralancesos";
  system.nixos.label = "V1";
  networking.hostName = lib.mkDefault "boralances";
  networking.networkmanager.enable = true;
  networking.firewall.enable = true;
  networking.networkmanager.wifi.backend = "iwd";
  systemd.services.NetworkManager-wait-online.enable = false;
  boot.kernelPackages = if config.boralances.kernel == "zen" then pkgs.linuxPackages_zen
    else if config.boralances.kernel == "lts" then pkgs.linuxPackages_6_12 else pkgs.linuxPackages_6_18;
  boot.initrd.availableKernelModules = [ "xhci_pci" "ehci_pci" "ahci" "nvme" "usb_storage" "uas" "sd_mod" "sr_mod" "virtio_pci" "virtio_blk" "virtio_scsi" ];
  boot.kernelParams = [ "quiet" "loglevel=3" ];
  boot.supportedFilesystems = [ "ext4" "vfat" "btrfs" "xfs" ];
  boot.kernel.sysctl = { "vm.swappiness" = 100; "vm.vfs_cache_pressure" = 100; };
  boot.loader.systemd-boot.enable = lib.mkDefault true;
  boot.loader.efi.canTouchEfiVariables = lib.mkDefault false;
  boot.loader.timeout = lib.mkDefault 2;
  zramSwap = { enable = true; algorithm = "zstd"; memoryPercent = 25; };
  services.journald.extraConfig = "SystemMaxUse=128M\nRuntimeMaxUse=32M\n";
  services.fstrim.enable = true;
  services.timesyncd.enable = true;
  services.openssh.enable = false;
  services.printing.enable = false;
  services.avahi.enable = false;
  services.blueman.enable = false;
  hardware.bluetooth = { enable = true; powerOnBoot = false; };
  hardware.enableRedistributableFirmware = true;
  hardware.enableAllFirmware = true;
  hardware.graphics = { enable = true; enable32Bit = true; };
  hardware.cpu.intel.updateMicrocode = true;
  hardware.cpu.amd.updateMicrocode = true;
  time.timeZone = lib.mkDefault "Europe/Istanbul";
  i18n.defaultLocale = "en_US.UTF-8";
  i18n.supportedLocales = [ "en_US.UTF-8/UTF-8" "tr_TR.UTF-8/UTF-8" ];
  nix.settings.experimental-features = [ "nix-command" "flakes" ];
  nix.settings.auto-optimise-store = true;
  # Retain application man pages, but avoid generating the full NixOS option
  # reference/manual on a lightweight live-image builder.
  documentation.nixos.enable = false;
  nix.gc = { automatic = true; dates = "weekly"; options = "--delete-older-than 30d"; };
  security.sudo.wheelNeedsPassword = true;
  security.polkit.enable = true;
  security.rtkit.enable = true;
  programs.dconf.enable = true;
  programs.tmux = { enable = true; extraConfig = builtins.readFile ../config/tmux.conf; };
  virtualisation.podman = { enable = true; dockerCompat = true; defaultNetwork.settings.dns_enabled = true; };
  environment.systemPackages = with pkgs; [
    alacritty git neovim btop ripgrep fd jq curl wget unzip zip file python3
    pciutils usbutils lm_sensors smartmontools nvme-cli
    parted gptfdisk dosfstools e2fsprogs util-linux rsync iw ethtool alsa-utils
  ];
}
