{ pkgs }: pkgs.buildFHSEnv {
  name = "boralances-unreal-env";
  targetPkgs = p: with p; [ stdenv.cc.cc zlib openssl curl libGL libglvnd vulkan-loader
    alsa-lib libpulseaudio SDL2 freetype fontconfig udev dbus libdrm libxkbcommon
    libx11 libxcursor libxext libxi libxrandr libxrender libxtst libxcb
    expat nspr nss icu libxml2 xz bzip2 ];
  runScript = pkgs.writeShellScript "boralances-unreal-start" ''
    if [[ $# -eq 0 || ! -f "$1" ]]; then
      echo 'Usage: boralancesos unreal run /path/to/Engine/Binaries/Linux/UnrealEditor' >&2
      exit 2
    fi
    exec "$@"
  '';
}
