{ stdenvNoCC, librsvg }:
stdenvNoCC.mkDerivation {
  pname = "boralances-identity";
  version = "1.0";
  src = ../assets;
  nativeBuildInputs = [ librsvg ];
  installPhase = ''
    mkdir -p $out/share/icons/hicolor/scalable/apps $out/share/boralances/brand
    cp icons/*.svg $out/share/icons/hicolor/scalable/apps/
    cp brand/* $out/share/boralances/brand/
    mkdir -p $out/share/icons/Boralances/scalable/apps
    cp icons/*.svg $out/share/icons/Boralances/scalable/apps/
    cat > $out/share/icons/Boralances/index.theme <<'THEME'
    [Icon Theme]
    Name=Boralances
    Comment=Original BoralancesOS glass application icons
    Inherits=Papirus-Dark,Adwaita,hicolor
    Directories=scalable/apps
    [scalable/apps]
    Size=64
    MinSize=16
    MaxSize=512
    Type=Scalable
    Context=Applications
    THEME
    while IFS=$'\t' read -r alias name; do
      cp "icons/$name.svg" "$out/share/icons/Boralances/scalable/apps/$alias.svg"
    done < icon-aliases.tsv
    for size in 32 48 64 128 256; do
      mkdir -p $out/share/icons/hicolor/''${size}x''${size}/apps
      for icon in icons/*.svg; do
        name=$(basename "$icon" .svg)
        rsvg-convert -w "$size" -h "$size" "$icon" -o $out/share/icons/hicolor/''${size}x''${size}/apps/$name.png
      done
    done
  '';
}
