# Optional hardware-specific build; NOT imported by the universal live images.
# Import only after reviewing the driver's dependency tree for the target machine.
{ lib, pkgs, ... }: {
  boot.kernelPackages = lib.mkForce (pkgs.linuxPackagesFor (pkgs.linux_zen.override {
    structuredExtraConfig = with lib.kernel; {
      HAMRADIO = no;
      ISDN = no;
      ATM = no;
      FIREWIRE = no;
    };
  }));
}
