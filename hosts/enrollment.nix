{ config, lib, pkgs, ... }: {
  users.users.${config.boralances.userName}.initialHashedPassword = "!";
  systemd.services.boralances-first-boot = {
    description = "Choose a BoralancesOS password";
    before = [ "greetd.service" ];
    after = [ "systemd-user-sessions.service" ];
    unitConfig.ConditionPathExists = "!/var/lib/boralances/password-set";
    preStart = ''${pkgs.plymouth}/bin/plymouth quit || true'';
    serviceConfig = {
      Type = "oneshot";
      StandardInput = "tty";
      StandardOutput = "tty";
      StandardError = "tty";
      TTYPath = "/dev/tty1";
      TTYReset = true;
      TTYVHangup = true;
    };
    script = ''
      echo 'Welcome to BoralancesOS. Choose your account password.'
      ${pkgs.shadow}/bin/passwd ${lib.escapeShellArg config.boralances.userName}
      mkdir -p /var/lib/boralances
      touch /var/lib/boralances/password-set
    '';
  };
  systemd.services.greetd = {
    requires = [ "boralances-first-boot.service" ];
    after = [ "boralances-first-boot.service" ];
  };
}
