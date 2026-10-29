{ stdenvNoCC, librsvg }:
stdenvNoCC.mkDerivation {
  pname = "boralances-plymouth";
  version = "0.1";
  src = ../config/plymouth;
  nativeBuildInputs = [ librsvg ];
  installPhase = ''
    theme=$out/share/plymouth/themes/boralances
    mkdir -p "$theme"
    cp boralances.script "$theme/"
    rsvg-convert -w 112 -h 112 ${../assets/brand/mark-white.svg} -o "$theme/logo.png"
    rsvg-convert ${../assets/brand/boot-track.svg} -o "$theme/track.png"
    rsvg-convert ${../assets/brand/boot-fill.svg} -o "$theme/fill.png"
    cat > "$theme/boralances.plymouth" <<EOF
    [Plymouth Theme]
    Name=BoralancesOS
    Description=A quiet, branded startup with real boot progress
    ModuleName=script
    [script]
    ImageDir=$theme
    ScriptFile=$theme/boralances.script
    EOF
  '';
}
