# BoralancesOS Desktop Experience 0.3

This update targets the existing native VirtualBox machine. No new ISO or OVA is generated.

Alt+Tab shows open application windows across desktops, including windows minimized by BoralancesOS. Releasing Alt selects the highlighted window and closes the switcher; Escape cancels. Win+Tab opens the Desktops overview with desktop creation, switching and moving the current window. Browser web tabs remain managed inside the browser.

The permanent dock groups application windows. Hover shows a chooser of window titles. Clicking an icon with one running window returns directly to it; an icon without a running window launches its application. Right-click provides pinning and a new-window action. Auto-hide mode retains the existing dock backend.

Optimization mode is the startup default. Gaming & Performance settings can select Fluid, Balanced, Liquid Glass, or remember the last profile. Four new optional widgets provide world clocks, active connections, desktop shortcuts and session controls. Richer glass transparency is enabled by the Glass profile, while Optimization uses opaque surfaces and disables compositor blur, animations and shadows.

The desktop includes native File and Go menus with icons, individual device panels, a calendar, Start application search, Edit Dock pinning, and a media status island. Panels dismiss when focus moves outside. Bare-desktop clicks can minimize the current app; this is configurable in Keyboard & Mouse. Normal app right-click menus remain available.

The widget gallery has 26 optional cards alongside the original clock and resource monitor. Keep unused widgets disabled. The GTK packaging fix prevents the previous widget restart loop. Clock-only widgets do not request keyboard focus.

New terminal controls include `boralancesos version`, `help`, `status`, `storage`, `uptime`, `network`, `display`, `logs`, `lock`, `screenshot`, `restart-shell`, `profile fluid`, `theme dark`, `center sound`, and `widget cpu on` / `off`. Existing Tor, Steam and optional rootless Kali commands remain available. `boralancesos kali install --dry-run` previews the optional tools without downloading them.

Routine systemd boot status is hidden. Journal diagnostics and recovery boot entries remain available.

VirtualBox performance investigation found repeated time catch-up delays and unreliable boots with the previous kernel on this Windows hypervisor host. The Oracle guest now uses Linux 6.12 LTS, two virtual CPUs, minimal paravirtualization, HPET disabled and VMSVGA 3D enabled. The login compositor uses Pixman and legacy KMS only inside Oracle guests. A fixed 1280x800 guest resolution avoids automatic resize churn and reduces rendering load. Windows security settings were not changed. Do not infer native gaming performance from this VM.

Validation evidence is under `test-output/experience-03`. Static checks ran 26 tests successfully with one POSIX-only test skipped on Windows, plus 52 JavaScript syntax checks. Live tests verified Alt release closes the switcher, Browser appears in its list, desktop window moves, dock hover selection, single-window return across desktops, and switching between Fluid and Optimization. Compositor requests sampled 40-72 ms including process startup; this is not an input-to-display latency measurement. Kernel logs still contain VirtualBox clock calibration and vmwgfx warnings. Tor routing, account sign-in, games and arbitrary EXE compatibility are not certified by these checks.

Two cold boots with Linux 6.12 reached the login screen and desktop. The final dock pin-menu patch was then activated live using the same kernel. A live unpin/repin test passed, and a minimized Browser was restored through the switcher. The final check reported 755 MiB used, no failed system/user units, no compositor configuration errors and no soft-lockup/RCU-stall matches in that boot's journal. These checks do not establish long-duration stability. Temporary test shares and the root test bridge were removed; the VM was left running in Optimization mode.
