# Liquid Glass design system

## Direction

Clarity, depth and a quiet desktop. The palette follows the supplied `Liqui(1).html` and the Browser project's optics: colored light behind a thick transparent edge, a restrained specular highlight and a readable interior. Navigation surfaces carry glass; text/document content uses stable, high-contrast backgrounds.

## Tokens

| Token | Dark | Light |
|---|---|---|
| Canvas | `#0A0D18` | `#EDF1F8` |
| Solid surface | `#141B2E` | `#FFFFFF` |
| Acrylic shell | `rgba(15,19,34,.83)` | `rgba(238,242,252,.94)` |
| Primary text | `#EAF0FF` | `#18243C` |
| Secondary text | `#AAB7D2` | `#344968` |
| Accent | `#8CBDFF` | `#315BA8` |
| Aurora accent | `#B5A5EF` | `#7361BA` |
| Success | `#A4E7D7` | `#216E60` |
| Critical | `#FFB1B8` | `#A52C43` |

Radii: 7 px workspace indicators, 12 px controls, 14 px panels, 16 px windows, 22–24 px dock/search. Spacing uses a 4 px scale, with 12 px screen margins, 10 px tiling gaps and 32 px content padding. The active border is a quiet 1 px blue/violet gradient. Avoid persistent glow loops or transparent body text.

Inter is the UI font; JetBrains Mono is the terminal/code font. Grayscale antialiasing is the default because fractional scaling and rotated/subpixel layouts vary. To explicitly request subpixel rendering on a confirmed RGB panel, override `fonts.fontconfig.subpixel.rgba = "rgb";` in the host module; use `bgr` for BGR panels. This does not force every Wayland toolkit to use subpixel text. SF Pro assets are not redistributed.

## Motion and materials

The Hyprland Lua configuration defines a spring with mass 1, stiffness 260 and damping 27, applied to window motion with roughly a 300 ms settling envelope. Workspace transitions use a 280 ms ease-out; fades are shorter. Reduced motion disables compositor animation. The glass web start page has static optics, without a continuously animated background.

| Effects profile | Blur | Passes | Motion | Shadow |
|---|---|---|---|---|
| Glass | Kawase, size 4 | 2 | Spring | Yes |
| Balanced, default | Kawase, size 3 | 1 | Spring | Yes |
| Performance / VirtualBox | Off | — | Off | Off |
| Reduced motion | Kawase, size 3 | 1 | Off | Yes |

The browser's one search lens additionally uses its original displacement-map optics, with frosted fallback. Browser refraction does not imply compositor-wide optical refraction. The Waybar/dock alpha material works without a permanent animation worker. Layer-surface blur must be verified against the pinned compositor and shell namespaces; the initial shell is readable with acrylic color alone. GameMode temporarily selects Performance and restores the user's saved effects afterward.

## Workflow

A compact top bar holds the app launcher, workspace indicators, focused-window title, clock, resource telemetry, audio, networking and power. It is an app-title bar, not an application-global menu: a real global menu requires application export/protocol support and is not claimed here. The lower dock auto-hides. Apps use dynamic tiling with explicit floating and fullscreen actions.

`Super+Space` opens apps. `Super+Tab` opens a title-card workspace overview grouped by workspace. There are no live thumbnails or constant screenshots in this version. `Super+V` toggles floating; `Super+1…0` selects workspaces; Shift adds moving a window. `Super+S` opens the scratch workspace. `Super+,` controls appearance/effects. `Super+Shift+L` locks the screen. `Print` captures a user-selected region.

## Accessibility and adaptation

Controls have visible focus rings, labelled buttons and keyboard access. The desktop supports high contrast through opaque application surfaces and reduced-motion/performance profiles. User monitor scale/keyboard overrides load last from `~/.config/hypr/local.lua`. Explicit dark/light/system choices are available in desktop and browser settings; automatic daylight scheduling and wallpaper-derived palettes are future enhancements, not implemented features.

Light desktop mode updates GTK preference and shell bar colors; independent apps decide whether they honor the preference. Browser toolbar appearance and its web start page have their own explicit settings. Do not promise that every third-party application adopts the same theme.

`design/desktop.html` illustrates the revised Mac-style composition with a slim menu bar, traffic-light window chrome, floating dock, application search, workspace overview and a Control Center. Welcome, startup and six installer states are available from Preview screens. It never installs an OS or changes host settings. `design/brand-board.html` presents the original logo and ten application icons.

The prototype now uses the supplied reference optics directly across glass surfaces and the 112×56 switch with a 76×56 lip thumb, a stiffness of 360 and damping of 27. Pointer pressure reveals the refractive thumb; release restores the solid thumb. Drag, click and arrow keys work, and motion stops after the spring settles. This remains a browser-rendered material demonstration. Native app surfaces use alpha/rim styling and compositor Kawase blur, rather than pretending that Qt widgets run browser SVG backdrop filters.

## Shipped native surfaces

- `assets/brand/`: original B ribbon, white and ink marks, construction metadata and boot progress artwork.
- `assets/icons/`: ten SVG app icons; the Nix identity package exports scalable and 32/48/64/128/256 px versions.
- `config/plymouth/`: quiet startup screen with actual boot-progress callbacks, password/question prompts and no artificial boot delay.
- `apps/companions/experience.py`: frameless welcome, Control Center and installer windows with matching traffic-light chrome and visible keyboard focus.
- Control Center: appearance, effects/reduced motion, volume, Do Not Disturb, network/audio/display settings, capture and screen lock.
- Installer: welcome, region/appearance, prepared destination, review/consent, real process progress/details, and completion/restart.

The first-run welcome appears once per user and is then dismissed permanently. Its memory is excluded from the closed-app idle target. Top-bar/dock/launcher layer blur is configured explicitly; validate the actual namespaces on the release build.
