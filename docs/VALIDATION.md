# Validation and release status

## Completed in this workspace

- Inspected the Liquid Glass HTML and the supplied BoralancesAnimations/Launcher project trees.
- Imported 377 allowlisted source/asset files with source/output SHA256 records; excluded personal runtime data and Windows binaries.
- Applied Linux launcher patches with exact-match checks.
- Passed 10 headless tests for URL safety, UTF-8/atomic state, import digests, registry consistency, runtime patches and credential exclusion.
- Parsed 23 Nix files with tree-sitter-nix; this is syntax verification, not Nix semantic evaluation.
- Checked 52 JavaScript/CJS files with Node's syntax checker.
- Checked shell syntax with Git Bash.
- Rendered and inspected the Mac-style desktop, light/dark materials, Control Center, welcome, startup, installing screen and brand board in Chromium. Workspace/search/installer navigation, reduced motion, reference-switch keyboard controls and mobile overflow checks pass with no page script errors.
- Rendered all three native Qt welcome/installer/Control Center windows on this Windows host with isolated state. Verified six installer pages and that explicit consent is required; no installation was started.
- Installed Nix 2.35.4 in the existing WSL Linux environment and generated the real `flake.lock` for nixpkgs `1f607aa79b6356ed45d3cd3c8079c196e79efa2c`.
- Successfully evaluated the installer and VirtualBox system configurations. Fixed the unfree-package setting, renamed Wine package and conflicting GameMode configuration exposed by evaluation.
- Built the complete installer package closure, including BoralancesBrowser and companion applications. Re-ran the ten application tests on Linux successfully.
- Generated `BoralancesOS-Installer-0.1-x86_64.iso` (6,236,504,064 bytes). Verified its El Torito BIOS/UEFI entries, hybrid MBR/GPT layout and SHA256: `f8c995187a1fc2e73cc3c30c5880ead2b42e0fea3477d5a8f0e94b723ffe8a27`.
- Booted that ISO under VirtualBox 7.2.22 with EFI, VMSVGA, 3D acceleration, SATA/AHCI, NAT, two CPUs and 4 GB RAM. Observed branded Plymouth startup, Hyprland, Waybar and the native welcome window. Mounted host shared folders successfully. Hyprland reports no configuration errors.
- Corrected display scaling to 1x during the live VM check and restarted the wallpaper after the scale change. `test-output/virtualbox-live-corrected.png` records the actual running Linux desktop, not the HTML prototype.
- Installed a complete system onto a 40 GiB dynamic VDI, booted it without the ISO, completed first-boot password enrollment and logged in as `bora`. Root and the unenrolled account were verified locked. QA changes are isolated in temporary snapshots and reverted for delivery.
- Verified the corrected installed desktop at 1280x800/1x with Linux 6.18.57: native welcome, Waybar, wallpaper, dock layer and BoralancesBrowser. `test-output/virtualbox-fixed-desktop.png` and `test-output/virtualbox-fixed-browser-ready.png` show the actual guest.
- After 125 seconds with user applications closed, measured **738,951,168 bytes (738.95 decimal MB)** used by `MemTotal - MemAvailable`, below the 800,000,000-byte target. This applies to the corrected VirtualBox candidate with 4 GB RAM, two CPUs, VMSVGA/128 MB/3D and the performance profile. Evidence: `test-output/guest-results/idle-validation/baseline.json`. It is not a bare-metal or universal memory guarantee.
- The idle check reported zero failed units. Both VirtualBox user services were active/running with one restart during console-switch testing. The boot trace includes the first-boot password enrollment delay and is not an unattended boot benchmark.
- Rebuilt the clean VM with the tested application-only graphics workaround, boot-checked its password-enrollment screen, restored the unbooted state and removed all QA snapshots. Exported a 7,596,626,432-byte OVA. All three internal SHA256 payloads verified, including the 40 GiB virtual disk; VirtualBox's import dry run passed. The native VM configuration contains no build shares, attached installation media or host build paths.

## Not yet verified

The separate persistent ISO and portable raw USB image remain unbuilt and untested. Bare-metal installation, Wi-Fi/audio/suspend, NVIDIA, clipboard transfer, unattended boot time and representative games/Wine/AppImage applications still need acceptance tests. The graphical installer's destructive path has not been exercised; the VirtualBox disk is provisioned through a separate guarded build script. Password-authenticated VBoxManage guest control failed in this setup; ordinary console/desktop login and sudo were tested successfully. Use the latest default Nix generation: earlier intermediate build generations can reproduce the graphics problems diagnosed during development.

The optional native browser QtWebEngine smoke test hit a Windows rendering/context timeout. In the live VM, QtWebEngine encountered VMSVGA graphics errors; enabling Mesa software rendering and disabling Chromium GPU acceleration allowed the native browser to open and render its start page. It also loaded `https://example.com` successfully; `test-output/virtualbox-resumed.png` records that HTTPS result. The browser now selects this fallback when the DMI product is VirtualBox, with explicit environment overrides respected. The sandbox remains enabled. Downloads and private-window behavior still need complete end-to-end tests.

Alacritty exhibited the same GPU-backed Wayland-buffer problem under the live Zen kernel. `LIBGL_ALWAYS_SOFTWARE=1 alacritty` opened successfully (`test-output/virtualbox-terminal-software.png`); the current source supplies an Oracle-only terminal wrapper with that fallback. Physical machines and explicit renderer overrides retain their own settings.

The current configuration applies the Oracle graphics fallback only to launched desktop applications. Setting `LIBGL_ALWAYS_SOFTWARE` on the compositor itself prevented Aquamarine from finding its renderer; the final configuration keeps that environment unchanged. UWSM supervises Hyprland directly, with the redundant watchdog notice disabled through its documented configuration option.

The ISO predates the final VM-specific 1x scaling, explicit filesystem-module list, application graphics fallbacks and VBoxClient foreground-service corrections. Those fixes are in the current source and installed VM configuration. In the ISO's VirtualBox live session, automatic scaling can enlarge the welcome window; use a suitable virtual display resolution or select 1x scaling. Switching to text consoles caused input-device problems in this VirtualBox setup; use the graphical terminal for ordinary work. Restarting the live graphical session restored input during testing. The ordinary ISO remains a volatile live environment.

## Release gates

| Gate | Required evidence |
|---|---|
| Nix evaluation | `nix flake check`, all public configurations evaluated, exact flake.lock archived |
| Artifact builds | All three ISO targets plus raw and VDI; SHA256 and package closures retained |
| Bare-metal boot | AMD and Intel graphics, UEFI, Wi-Fi, audio, suspend/resume, input and storage |
| NVIDIA | GPU-specific driver profile, modesetting, external display and suspend tests |
| Installer | Empty/existing destination, correct block-device checks, interrupted install, password entry, reboot |
| Persistent live | Two cold boots retain notes, bookmarks, Wi-Fi, user package/profile and Flatpak state |
| Portable image | Removable UEFI boot, first-boot password enrollment, full-root persistence and root growth |
| VirtualBox | EFI, VMSVGA, AHCI, resize, shared folder, conditional service startup; clipboard status reported |
| Memory/boot | `scripts/measure.sh` after 120 seconds, 800 decimal MB target, boot/critical-chain trace |
| Browser | HTTPS, downloads/cancel, permission dialogs, private storage disposal, tabs, restart, workspace |
| Launcher | Vanilla + one Fabric game, native Java major selection, account login, mods, game exit, secure keyring |
| Game behavior | GameMode restores effects; compare 1% low/frame pacing at identical game settings |
| App formats | Representative supported Wine app, AppImage and Flatpak launch |
| Recovery | Previous generation boots; rollback retains user data; broken graphics recovery path works |

Do not promote the source release as a validated distribution until these gates pass. Keep measured results tied to exact hardware, driver, kernel, package revision and build hash.
