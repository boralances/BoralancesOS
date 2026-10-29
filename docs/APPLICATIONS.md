# Bora's application suite on Linux

The supplied folders were inspected and a source-only snapshot was imported. Existing Windows projects are unchanged. The importer records source/output SHA256 values in `integrations/import-manifest.json`; it fails if an expected patch location changes rather than silently producing an incomplete port.

| Project | Included integration | Remaining boundary |
|---|---|---|
| BoralancesBrowser | Native Python/PySide6 QtWebEngine tabs, privacy profiles, bookmarks, downloads, find, explicit workspaces, light/dark toolbar and glass home | Separate implementation; Windows browser feature parity is not complete |
| Boralances Launcher 1.8.3 | Original Electron renderer/backend, native Python runtime, Linux user-data location, Java 8/17/21/25 mapping, assets/client content | Gameplay, authentication, chat and game downloads require Linux end-to-end checks |
| Boralances Client | Original client JARs and bundled launcher assets | Only versions/loaders supported by the original launcher; mods are not running desktop services |
| JARVIS | Native on-demand typed commands, notes, timers, media controls, browser/files/calculator/launcher, scrcpy | Voice/claps, Gemini streaming, Android control protocol and Windows DPAPI are not ported |
| HDMI / Glass Connect | Native monitor inspector, `nwg-displays`, appearance controls and browser glass preview | Automatic HDMI animations and Windows taskbar overlays are not ported |
| Unified BoralancesOS.exe suite | Separate native desktop app entries | The existing EXE remains a Windows application, not a Linux installer |
| Boralances Chat | Browser desktop entry and launcher's original embedded chat | Remote service, requires network and its own login |
| Android companion | Optional existing JARVIS APK, no signing key | Android-only; Linux JARVIS does not implement its Windows host protocol |

Installer scripts, updater PowerShell helpers, old Windows EXEs, Windows runtime DLLs, caches, accounts, browser cookies, local notes, private release keys and existing instance data are not imported. Only the launcher's pure-JavaScript `adm-zip` production dependency is copied from `node_modules`; Electron comes from nixpkgs. Existing provider credentials are replaced by an environment lookup or user entry in Settings. Public service configuration remains in application source as required by the application.

## Browser architecture

The Windows browser uses .NET Framework/WinForms and Edge WebView2. WebView2 is not a Linux runtime. The Linux port uses QtWebEngine, whose browser engine is supplied and updated with the pinned NixOS package set. It reuses the source project's Snell-law glass factory and start-page visual language, not Windows profiles or authentication blobs.

Use `Ctrl+T/W/L/D/F/J`, `Ctrl+Shift+N`, and `Ctrl+R`. Regular profiles persist under the Linux user's data directory. Private windows have off-the-record profiles, keep no bookmarks/workspaces, and do not persist browsing storage; downloads still write to the location the user selects. This is session privacy, not anonymity. Tor mode, extensions, AI answers and the original BM25 search engine are not advertised by this Linux port.

The supplied glass factory produces displacement maps from surface normals and a refractive index, plus a specular rim. The web page creates only one static refractive surface at a time and regenerates after layout changes. There is no idle WebGL wallpaper loop. Outside browser-owned surfaces, the compositor uses blur and transparency; it does not apply arbitrary SVG refraction across all application windows.

## Launcher changes

The original Windows launcher searches for `python.exe`, places development data beside source and downloads Windows updates. The imported copy uses the packaged Linux Python interpreter, an Electron `appData` path, and native Nix-provided Java executables selected by the Minecraft metadata's required Java major version. Versions not covered by that map can still use the original runtime resolution or a manually selected executable.

The launcher keeps its original renderer isolation. Electron secret storage must use an encrypted backend; `basic_text` is rejected. GNOME Keyring is integrated through PAM. If keyring unlock or encryption is unavailable, saving credentials fails rather than downgrading to plaintext. Windows owner-PC enrollment is disabled, and Windows owner identities/tokens are never imported. Minecraft and Boralances accounts must sign in again.

The Windows update feed is not used automatically on Linux. System rebuilds provide app updates; download/apply remains marked unsupported in the Linux state. The original Java selection filter is widened for Linux executables. Windows-specific administrative/update tools may still require further porting; they are not part of the supported Linux feature contract.

## Gaming

Steam's compatibility tool handles Windows games; choose Proton per game. A useful Steam launch option is:

```text
gamemoderun mangohud %command%
```

GameMode reduces desktop blur/animation through the controller while active and restores the user's saved profile afterward. Gamescope is available as a per-game nested compositor; do not impose it on every game. Tune resolution, refresh, VRR and frame caps per display. Shader-cache warmup, actual GPU drivers and power/thermal limits matter more than decorative “FPS boost” switches.

Linux Minecraft launches are wrapped with the packaged `gamemoderun`. Installed instances retain their Java major version, allowing each OS generation to resolve its current native Java path instead of relying forever on an old Nix store path.

AMD/Intel use Mesa from the NixOS graphics stack. For NVIDIA, add a hardware-specific module after detection (for example `services.xserver.videoDrivers = [ "nvidia" ];` plus the relevant modesetting/open-kernel choice for that GPU). A universal proprietary NVIDIA configuration is intentionally not forced onto all machines. Secure Boot requires an additional reviewed signing/enrollment setup; it is not configured by this framework.

Wine does not guarantee that every Windows application works, especially WebView2, anti-cheat, kernel drivers, DRM and complex Adobe/Office software. Use `boralances-exe /path/to/app.exe` or the file association. For games, prefer the launcher's own Proton/Wine management and separate prefixes. Never advertise all EXEs or all anti-cheat games as compatible.

AppImage support uses NixOS's `appimage-run` integration. Download a compatible x86_64 image, mark it executable and run it; `appimage-run path/to/app.AppImage` is the explicit fallback. Flatpak is available; add a remote explicitly rather than downloading apps during first login.

## Extending the suite

Edit `integrations/applications.json` when adding projects and give each one a native package/desktop entry or an explicitly labelled compatibility route. Keep project assets separate from mutable state. `scripts/import-projects.py` can refresh this snapshot from the two original folders and reapplies the Linux patches. Review changes and rerun validation after every import.

References: [Qt profile persistence](https://doc.qt.io/qtforpython-6/PySide6/QtWebEngineCore/QWebEngineProfile.html), [NixOS AppImage module](https://github.com/NixOS/nixpkgs/blob/1f607aa79b6356ed45d3cd3c8079c196e79efa2c/nixos/modules/programs/appimage.nix), [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).
