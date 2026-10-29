# Sources and redistribution

- The existing Boralances Launcher identifies itself as MIT licensed. Its license is retained in `vendor/boralances-launcher/LICENSE`.
- The ribbon monogram and ten application icons in `assets/brand/` and `assets/icons/` are original SVG artwork made for this project. They do not incorporate Apple logos or proprietary SF Symbols.
- `adm-zip` 0.5.16 is copied as the pure-JavaScript production dependency, with its original license.
- `minecraft-launcher-lib` 8.0 is included as its unmodified PyPI wheel under `vendor/python/`; its metadata and license are retained inside the wheel.
- The reference glass factory and Google visual assets come from Bora's local BoralancesBrowser/web project, itself adapted from the user-supplied `Liqui(1).html`. Imported-file SHA256 records are in `integrations/import-manifest.json`. Confirm redistribution rights before publishing these local assets beyond the user's own project.
- The JARVIS APK is the supplied signed artifact. Its signing key, user data and private desktop credentials are excluded.
- Minecraft client JARs, cosmetics and ready-pack assets retain their upstream project metadata. Game files and third-party mods referenced by manifests are downloaded by the launcher; redistribution permissions remain with their authors.
- NixOS/nixpkgs, Linux, Hyprland, Qt/PySide6, Chromium/QtWebEngine, Electron, Wine, Steam, VirtualBox guest additions and other packages retain their upstream licenses. The package manager's metadata does not replace a final image license audit. Steam and some optional game components are proprietary; `allowUnfree` is enabled for the requested gaming edition.
- No Microsoft WebView2 SDK/runtime, SF Pro font, Windows executable, release private key, DPAPI-protected secret or browser profile is redistributed by the importer.

This is an independent project. No affiliation with Apple, Microsoft, Valve, Oracle or the NixOS Foundation is implied.
