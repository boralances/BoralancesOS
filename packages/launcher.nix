{ stdenvNoCC, lib, makeWrapper, electron, python3, jdk8, jdk17, jdk21, jdk25, gamemode, systemd }:
let
  minecraft = python3.pkgs.buildPythonPackage {
    pname = "minecraft-launcher-lib";
    version = "8.0";
    format = "wheel";
    src = ../vendor/python/minecraft_launcher_lib-8.0-py3-none-any.whl;
    dependencies = [ python3.pkgs.requests ];
    pythonImportsCheck = [ "minecraft_launcher_lib" ];
  };
  python = python3.withPackages (p: [ minecraft p.requests ]);
in stdenvNoCC.mkDerivation {
  pname = "boralances-launcher";
  version = "1.8.3-linux.1";
  src = ../vendor/boralances-launcher;
  nativeBuildInputs = [ makeWrapper ];
  postPatch = ''
    # Fit the Linux desktop's 1280x800 VM display, including menu bar and dock.
    substituteInPlace src/main.cjs --replace-fail \
      'width:1380,height:920,minWidth:1080,minHeight:760' \
      'width:1100,height:660,minWidth:900,minHeight:560'
  '';
  installPhase = ''
    mkdir -p $out/share/boralances-launcher $out/share/applications $out/share/icons/hicolor/256x256/apps $out/bin
    cp -r . $out/share/boralances-launcher/
    cp assets/launcher.png $out/share/icons/hicolor/256x256/apps/boralances-launcher.png
    makeWrapper ${electron}/bin/electron $out/bin/boralances-launcher \
      --add-flags "$out/share/boralances-launcher --ozone-platform-hint=auto" \
      --run 'if [ "$(${systemd}/bin/systemd-detect-virt)" = oracle ]; then set -- --disable-gpu "$@"; fi' \
      --set BORALANCES_PYTHON ${python}/bin/python3 \
      --set BORALANCES_GAMEMODERUN ${gamemode}/bin/gamemoderun \
      --set BORALANCES_JAVA_8 ${jdk8}/bin/java \
      --set BORALANCES_JAVA_17 ${jdk17}/bin/java \
      --set BORALANCES_JAVA_21 ${jdk21}/bin/java \
      --set BORALANCES_JAVA_25 ${jdk25}/bin/java
    cat > $out/share/applications/boralances-launcher.desktop <<EOF
    [Desktop Entry]
    Type=Application
    Name=Boralances Launcher
    Comment=Minecraft instances, mods, cosmetics and Boralances Chat
    Exec=boralances-launcher
    Icon=boralances-launcher
    Categories=Game;
    StartupWMClass=boralances-launcher
    EOF
  '';
  meta = { description = "Bora's Minecraft launcher, adapted for BoralancesOS"; platforms = [ "x86_64-linux" ]; license = lib.licenses.mit; };
}
