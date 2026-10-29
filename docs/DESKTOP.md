# Desktop Experience 0.2

This update changes the installed VirtualBox desktop and the rebuildable source. Earlier installer ISO and OVA archives retain their 0.1 desktop until rebuilt; do not treat their existing checksums as checksums of a VM disk that has since been started or updated.

## Navigation

The menu bar spans the top edge. Its BoralancesOS menu opens applications, System Settings, workspace overview, files, Activity Monitor, desktop repair and screen locking. Search and settings buttons remain available at the right. CPU/RAM meters are optional.

The dock is visible by default and reserves space below floating windows. Files, browser, launcher, terminal, settings, overview and Trash are pinned in the updated local VM. Right-click icons for the dock's window and pinning actions. System Settings controls hiding, position and size.

These are original Linux desktop surfaces inspired by familiar macOS conventions. The menu bar is not an application-wide macOS global-menu implementation.

## Settings

Ten searchable categories: Desktop; Appearance; Dock & Menu Bar; Displays; Keyboard & Mouse; Sound & Notifications; Network; Gaming & Performance; Storage & Apps; About & Power.

Saved controls include new-window layout, dark/light preference, four accents, four wallpapers, four effects profiles, dock options, optional resource meters, 12/24-hour clock, US/Turkish layouts, Caps/Escape mapping, pointer speed, touchpad scrolling/tapping, notification pausing and idle-lock timeout. Native windows read their appearance when opened. Resolution, network and audio controls open their actual system utilities. Power/session operations require confirmation in the settings window.

Settings commands use asynchronous QProcess execution and report failures. Backend values are allowlisted; failed preference application restores the previous saved state. No settings process runs while the app is closed.

## Responsiveness

The local VM has four vCPUs and 4 GiB RAM. Performance mode disables compositor blur, shadows and animation. Native Qt surfaces become opaque in this profile; wallpaper artwork is static. A minimal browser start page replaces animated web effects inside VirtualBox.

The VM's default Terminal uses Foot and shared-memory Wayland rendering. Alacritty stays installed and remains the default terminal on physical installations. The terminal/browser compatibility fallback is restricted to those apps; launchers and games do not inherit forced software OpenGL from the desktop.

Menu bar, dock, wallpaper and idle-lock processes are supervised by individual user units tied to graphical-session.target, with bounded stop times and failure restarts. They replace the corresponding unsupervised processes rather than adding duplicate copies.

The Windows host currently runs VirtualBox through its NEM/Windows hypervisor backend, as recorded in VBox.log. This update does not modify Windows virtualization or security settings. VM graphics still differ from native hardware; frame-time benchmarks remain a separate acceptance test.

A runtime comparison isolated an idle redraw loop to Waybar's static logo image widget in the pinned build. With an unspecified refresh interval, the image-only bar measured 41.63% active CPU over a five-second sample. An explicit 3600-second refresh interval measured 0.93%; the full bar with that image widget removed measured 1.09%. The shipped configuration sets the explicit interval, retaining the logo and other modules. These short guest measurements diagnose the loop; they are not game/frame-time benchmarks.

## Shortcuts

| Shortcut | Action |
|---|---|
| Super+Space | Search applications |
| Super+Return | Terminal |
| Super+B / Super+E | Browser / files |
| Super+, | System Settings |
| Super+Tab | Workspace overview |
| Super+V | Float/tile current window |
| Super+F / Super+Q | Full screen / close |
| Super+1–9 | Switch desktop |
| Super+Shift+3 | Save full screenshot to Pictures/Screenshots |
| Super+Shift+4 | Capture and annotate a region |
| Super+Ctrl+R | Restart dock and menu bar |
| Super+Shift+L | Lock screen |

## Verification

The update adds regression checks for a permanently visible dock, explicit autohide, restart visibility of saved state, rollback after failure, command-value validation, optional resource meters and clock format. All ten settings pages are rendered in the Linux guest. Runtime results are recorded separately in test-output/desktop-update; source checks are not a substitute for the installed-session checks.

The final installed session passed 38 runtime checks and all 16 Python tests in Linux, with zero compositor configuration errors and no failed system or user units. After a 30-second settling period, a five-second sample measured 4.6% CPU and 671,272,960 bytes of memory in use; one terminal window was open. The sample is a short VM observation, not a sustained frame-time or gaming benchmark.
