{
  description = "BoralancesOS V1 — glass, without the weight";
  # nixos-26.05 revision resolved on 2026-10-25. Updates are deliberate.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/1f607aa79b6356ed45d3cd3c8079c196e79efa2c";
  outputs = { self, nixpkgs }: let
    system = "x86_64-linux";
    lib = nixpkgs.lib;
    pkgs = import nixpkgs { inherit system; config.allowUnfree = true; };
    distributionSource = lib.cleanSourceWith {
      src = ./.;
      filter = path: type: let name = baseNameOf path; in
        !(builtins.elem name [ ".git" ".cache" ".codex" "out" "test-output" "__pycache__"
          "hardware-configuration.local.nix" "installer-preferences.nix" "drivers.local.nix" "account.json" ]
          || name == "result" || lib.hasPrefix "result-" name || lib.hasSuffix ".pyc" name);
    };
    make = host: lib.nixosSystem {
      inherit system;
      specialArgs = { source = distributionSource; };
      modules = [ ./modules ./hosts/${host}.nix ];
    };
    installer = make "installer";
    live = make "live";
    persistent = make "persistent";
    portable = make "portable";
    vbox = make "virtualbox";
    disk = name: configuration: format: import "${nixpkgs}/nixos/lib/make-disk-image.nix" {
      inherit pkgs lib format;
      config = configuration.config;
      name = "boralancesos-${name}";
      baseName = "BoralancesOS-${name}-0.1-x86_64";
      diskSize = "auto";
      additionalSpace = "6G";
      bootSize = "1024M";
      partitionTableType = "efi";
      label = "BORALANCES";
      memSize = 4096;
      copyChannel = false;
    };
  in {
    nixosModules.default = import ./modules;
    nixosConfigurations = {
      inherit installer live persistent portable;
      virtualbox = vbox;
    } // lib.optionalAttrs (builtins.pathExists ./hardware-configuration.local.nix) {
      workstation = make "workstation";
    };
    packages.${system} = {
      installer-iso = installer.config.system.build.isoImage;
      live-iso = live.config.system.build.isoImage;
      persistent-iso = persistent.config.system.build.isoImage;
      usb-image = disk "USB" portable "raw";
      virtualbox-image = disk "VirtualBox" vbox "vdi";
      browser = pkgs.callPackage ./packages/browser.nix { };
      launcher = pkgs.callPackage ./packages/launcher.nix { };
      default = self.packages.${system}.installer-iso;
    };
    checks.${system} = {
      browser-tests = pkgs.runCommand "boralances-browser-tests" { nativeBuildInputs = [ pkgs.python3 ]; } ''
        export PYTHONDONTWRITEBYTECODE=1
        cd ${self}
        python -m unittest discover -s tests -v
        touch $out
      '';
      configurations = pkgs.runCommand "boralances-configurations" { } ''
        printf '%s\n' ${lib.escapeShellArgs (map (c: c.config.system.build.toplevel.drvPath) [ installer live persistent portable vbox ])} > $out
      '';
    };
    devShells.${system}.default = pkgs.mkShell {
      packages = with pkgs; [ nixfmt shellcheck python3 nodejs lua qemu OVMF ];
    };
  };
}
