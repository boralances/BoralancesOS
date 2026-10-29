{ lib, python3Packages, qt6, makeDesktopItem, copyDesktopItems }:
python3Packages.buildPythonApplication {
  pname = "boralances-browser";
  version = "0.1.0";
  pyproject = true;
  src = ../apps/browser;
  build-system = [ python3Packages.setuptools ];
  dependencies = [ python3Packages.pyside6 ];
  nativeBuildInputs = [ qt6.wrapQtAppsHook copyDesktopItems ];
  buildInputs = [ qt6.qtwayland qt6.qtwebengine ];
  dontWrapQtApps = true;
  makeWrapperArgs = [ ];
  preFixup = ''makeWrapperArgs+=("''${qtWrapperArgs[@]}")'';
  desktopItems = [ (makeDesktopItem {
    name = "boralances-browser";
    desktopName = "BoralancesBrowser";
    genericName = "Web Browser";
    exec = "boralances-browser %U";
    icon = "boralances-browser";
    categories = [ "Network" "WebBrowser" ];
    mimeTypes = [ "text/html" "x-scheme-handler/http" "x-scheme-handler/https" ];
  }) ];
  meta = { description = "Native Linux browser with Boralances glass optics"; mainProgram = "boralances-browser"; platforms = [ "x86_64-linux" ]; };
}
