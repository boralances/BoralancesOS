# Application launch repair — 2026-10-27

## Current status

The permanent dock/menu launch fix was activated and verified after restarting the installed VM. The temporary per-user overrides were disabled, preserving their contents as `.conf.disabled` files. All four native desktop services now include the system application profile in their actual process environment. Default Sound Settings and Launcher launches also rendered successfully, with no SharedImage errors.

The final installed system is `/nix/store/mhj1siarck5z9xd10qqbq9zyvck14aal-nixos-system-boralances-vbox-26.05.20261025.1f607aa`. It boots at 1280x800 with no Hyprland configuration errors and zero failed user or system units. Installed-package browser search, normal Sound Settings and Launcher commands, and Steam's sign-in screen passed the final checks. The transient repair shares were unmounted and removed.

No ISO is being rebuilt, at the user's explicit request. The existing ISO and OVA predate these repairs. Current authoritative edits are in the project source and installed/staged NixOS configurations.

## Confirmed cause and changes

The Nix-generated systemd user service environment provided a minimal PATH. The desktop controller added its runtime dependencies, but `/run/current-system/sw/bin` was absent. The dock journal therefore reported `executable file not found in $PATH` for installed apps. The dock's application search inherited that same incomplete environment.

`modules/desktop.nix` now supplies the system and user application paths explicitly to the menu bar, dock, wallpaper and idle services. The idle service also needs access to its lock/display commands.

Two additional VirtualBox compatibility fixes are staged:

- `pavucontrol` uses the Cairo renderer inside Oracle guests. The default renderer exited with `Lost connection to Wayland compositor`; the targeted Cairo launch rendered the actual mixer successfully.
- Boralances Launcher uses Electron's `--disable-gpu` flag inside Oracle guests, without exporting software-OpenGL settings into games. Its renderer previously emitted repeated SharedImage errors. The targeted launch rendered with no such errors. Its Linux window geometry is patched during packaging to fit the 1280×800 desktop, and it receives an application-specific floating rule.

The original imported launcher files remain unchanged; the geometry adjustment is a build-time patch. Browser/renderer sandboxing remains enabled.

## Evidence

`test-output/app-repair` contains the environment comparison, dock journal, launch audit, startup logs and actual guest screenshots. Browser launch was also tested by clicking its real dock icon and loading an HTTPS page.

Desktop-entry launches produced windows for Files, Browser, Launcher, Settings, Overview, JARVIS, Glass Connect and Terminal after the PATH repair. Network, Displays, Calculator, Editor, Lutris and Heroic also opened. Application search produced its Wayland layer. Sound Settings passed its separate Cairo-renderer test. These tests cover startup/rendering, not account authentication or game launches.

All 16 Python tests completed successfully on the Windows source check, with the POSIX-only seed-file test skipped there; JavaScript syntax checks passed for 52 files. The repaired NixOS system configuration built successfully.

Steam's real sign-in screen now renders successfully (`steam-login-verified.png`), and the X11 query passes. No account sign-in or game download was attempted. An X11 probe had reproduced Xwayland failing with `invalid arguments for wl_surface.attach`. The Oracle-only desktop session now selects Xwayland's shared-memory backend with `XWAYLAND_NO_GLAMOR=1`. This fallback disables Xwayland's Glamor/DRI3 acceleration inside VirtualBox and does not promise native gaming performance. Native hardware retains its existing graphics environment. See the [Xwayland manual](https://man.archlinux.org/man/Xwayland.1).

VirtualBox's vmwgfx stack also rejected larger display modes during atomic test commits. The Oracle session passed with the legacy KMS fallback (`AQ_NO_ATOMIC=1`) and a 1280x800 default. This is a targeted compatibility exception, with explicit environment overrides retained; the upstream [Aquamarine documentation](https://wiki.hypr.land/configuring/core/environment-variables/) discourages disabling atomic modesetting generally. The VM creation script also selects Oracle's documented [1280x800 EFI resolution](https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/working-with-vms.html).

The final fresh installed session before launching Steam measured 627.5 MiB (MemTotal minus MemAvailable); after exercising and closing Steam, Browser, Sound and Launcher it measured 779.2 MiB with the repair terminal still open. These are VM samples, not hardware benchmarks. VirtualBox speaker output is now enabled; microphone input remains off.

Browser search failed only when initiated by the restricted local home page; identical native address-bar navigation passed. The browser now defers trusted home-page HTTP(S) main-frame navigation to a native load, with a one-use guard against recursion. Remote subresource and arbitrary local-file restrictions remain enabled. Both the form and native search paths passed the candidate and installed-package probes. This follows the local-origin distinction documented by [Qt WebEngine](https://doc.qt.io/qtforpython-6/PySide6/QtWebEngineCore/QWebEngineSettings.html).

The user freed approximately 9 GB on C:, allowing work to resume. Automatic approval review blocked the requested removal of `out/BoralancesOS-VirtualBox-0.1.ova`, reporting only `blocked by policy`. No alternative deletion mechanism was used. This obsolete portable export remains a 7.6 GB manual cleanup candidate; the native `.vdi`, `.vbox` and `.nvram` must be retained.

## Verification and limits

`test-output/app-repair/acceptance.json` records the final acceptance gates. The full source ZIP is refreshed separately from the unchanged ISO and OVA. Guest trim reclaimed approximately 3 GB on the host without removing user files.

Testing covers application startup, rendered UI, browser navigation, dock/application-search launching and service health. Steam and Launcher account authentication, actual games, Wine EXE compatibility, AppImage execution, Android connection and bare-metal graphics remain outside this repair's verified scope.

The local account password was supplied separately by the user and is not stored in this report.
