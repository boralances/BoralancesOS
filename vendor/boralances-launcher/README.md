# Boralances Launcher 1.7.8
Windows Minecraft Java launcher with an installer and portable build with Liquid Glass, Dark and Light themes, offline profiles, separate instances, Fabric/Quilt/Forge/NeoForge, community content installers and a free cosmetic wardrobe.

## Run
Run release/BoralancesLauncher-Setup-1.7.8.exe for the guided installer, or open release/BoralancesLauncher-1.7.8.exe for portable use. Installed data lives under %APPDATA%/BoralancesLauncher/data and survives updates/uninstall; portable data stays beside the executable. The installer creates Start menu and desktop shortcuts. Existing portable instances stay in their original folder.
- Ready instances offers downloadable .mrpack files for exact 26.3, 1.21.11, 1.21.1 and 1.20.1 Fabric Optimization + Extras instances. Download .mrpack exports a portable manifest; Install instance downloads the pinned mods, game files, Java and Fabric. Failed installations resume through Install / repair. Each pack includes FancyMenu, Drippy Loading Screen, Essential, Ears, CustomSkinLoader, Emotecraft and 20 original animations. Choose an instance name, Aurora/Glacier/Verdant/Ember design and a performance profile before installing or exporting; the exported configs and artwork reflect those choices. Early Loading Screen is included on 1.21.1 and 1.20.1. Third-party JARs download directly from their providers.
- New instance lets you choose any officially listed game version and an upstream-supported loader build.
- Sign in to Boralances or BoralancesChatting, then choose an offline name and press Play. First installation needs internet. Subsequent launches use local files. Microsoft sign-in is optional; authenticated servers require a legitimate Minecraft account.
- Discover and Installed content manage mods, packs, shaders, resources and world-specific datapacks. Shader/resource packs also need enabling in Minecraft.
- Client features offers 41 optional HUD, style, control and performance features. FPS Boost, essentials, style and recommended presets check compatibility and deduplicate providers/dependencies.

Offline names use Minecraft's standard name-derived UUID. Changing a name can change world inventory identity. Four loader catalogs are supported, but upstream maintainers determine which game/loader combinations exist. No guarantee is made for every historical combination or arbitrary mod compatibility.

## Performance and client features
Press F9 while playing one of the four ready Fabric instances to open the built-in Boralances Client menu. Choose among 66 free capes, 40 animated Ears wings, 18 elytra textures and 20 Emotecraft animations without restarting. The menu uses Minecraft buttons, keyboard navigation and a real local-player preview. Done or Escape returns to play. This original addon supports only the four listed Fabric versions; other loader/version combinations use their installed providers.
HUD starts disabled to avoid duplicating Widgets. Press F7 to drag, position and configure independent FPS, CPS, ping, coordinates, memory and clock widgets. Save persists changes; Cancel or Escape restores them. Widget visibility, snapping, panel background and opacity are configurable; F1 hides the HUD. Reassign wardrobe, HUD and chat keys in Minecraft Options → Controls → Key Binds → Boralances; conflicting shortcuts appear in Minecraft’s controls screen. Reduced motion is available in the client menu. Tweaks changes real view/simulation distance, particles, FPS limit, entity density, Vsync, shadows, bobbing, automatic jumping and effects; Restore this session returns the settings captured before applying a profile. Native gameplay and FPS gains remain unverified.
FPS/CPS/ping also use a compatible HUD mod. On instances using Widgets, press Right Shift or use /widgetsmod to configure counters and edit layout. Each card shows its selected provider and instructions.
Includes 3D Skin Layers, Ears skin cosmetics, animated capes, Emotecraft, player animations, Mouse Tweaks, zoom, hunger information and Mod Menu. Optimization providers include compatible Sodium/Embeddium, Lithium, FerriteCore, Entity Culling, More Culling, ImmediatelyFast, ModernFix, BadOptimizations, Dynamic FPS, Sodium Extra and Krypton. Additional ready features include Reese’s Sodium Options, FastQuit, Smooth Swapping, Smooth Scroll, Controlling, ShulkerBoxTooltip and BetterF3. Inventory Profiles Next, ThreadTweak and Noisium are individually selectable advanced options. Search client features, filter by category/status, and keep selections when switching filters.
Advanced culling/rendering options are individually selectable. Spark is diagnostic. Older memory-leak fixes may have no compatible release. Recommended installation excludes advanced, diagnostic, menu and social options. Ready packs explicitly include the requested menu/social mods with their audited dependencies.
Balanced, Low-end PC and Maximum FPS change a small set of options.txt settings. The original file is backed up once; Restore previous settings restores it exactly. Lower view/simulation distances and visual density reduce rendering work. FPS improvement depends on hardware and other mods; no gameplay benchmark was measured.
The pinned ready packs contain 39 mod/dependency files on 26.3, 41 on 1.21.11, 42 on 1.21.1 and 41 on 1.20.1. ModernFix is skipped on 26.3 and 1.21.11. Ok Zoomer supplies zoom on 26.3; Logical Zoom supplies zoom on 1.20.1. CPS Plus supplies the older CPS fallback. All four manifests passed their required Fabric dependency predicates. Live metadata can change. These checks establish declared compatibility, not gameplay stability.

## Embedded chat and physical glass
The Chat page loads https://boralances.boranil400.workers.dev/chat inside an isolated launcher view. The Account page's Login with BoralancesChatting opens that view; after the platform login, Use this chat account verifies the existing session with its proxy and displays the public identity. It does not grant launcher admin or replace the separate Firebase/Microsoft sessions. Camera and microphone permissions currently stay disabled.
Press F4 while in a supported Fabric instance to use chat inside Minecraft. Keep the launcher running; Escape or Back to game closes it. The launcher renders bounded local frames only while chat is open. Login sessions are isolated from other applications, and the per-run bridge token is excluded from instance backups. No external browser is opened.
The Liquid Glass launcher theme now uses a generated Snell–Descartes refraction map, an SVG displacement filter and a rim highlight. Blur provides the fallback. Refraction pauses during gameplay and on hidden panels. The standalone adjustable demo is design/liquid-glass/index.html.
The same theme is applied inside the embedded chat views. The matching additive BoralancesChatting website theme module is in integrations/boralanceschatting/. It was applied to C:/Users/Bora/Documents/GitHub/web1/chat.html. It is scoped to the existing liquidglass theme, caps active glass surfaces at twelve, respects reduced transparency and regenerates only after layout or material changes. The website source still needs its normal deployment to update the hosted site.

## Custom ready menus and loading
Each version has an original default design: Aurora (26.3), Glacier (1.21.11), Verdant (1.21.1), Ember (1.20.1). All four designs are selectable for every version. Packs include local artwork, nine-slice button textures, window icons/title, a FancyMenu title layout and a Drippy resource-loading layout. The progress bar uses Drippy's real game_loading_progress placeholder. Vanilla play/options/quit actions and Essential widget controls remain intact; Minecraft branding/footer is preserved.
Early Loading Screen supplies Fabric startup diagnostics on 1.21.1 and 1.20.1. It has no compatible Fabric release for 26.3 or 1.21.11. Drippy Early Loading Module targets Forge/NeoForge and is not placed in these Fabric packs. The early Fabric progress window uses the mod's stock presentation; the subsequent Drippy screen is branded.
Essential is an official bootstrap JAR: its runtime downloads on first game launch, and online services need an Essential account/connection. FancyMenu's author reports version-dependent Essential integration issues. These packs leave Essential widgets untouched, but native gameplay and integration stability still need checking on an unrestricted host.
On 1.20.1, Emotecraft's catalog pin targets Fabric API 0.86.1, while current menus need at least 0.92.2. This pack explicitly uses the current compatible Fabric API after verifying Emotecraft's JAR permits any API version. The override is recorded in boralances-preset.json; the normal catalog installer retains strict pin handling. All 1184 pack dependency predicates pass the real Fabric Loader parser.
See design/CUSTOM-READY.md for configuration locations. [FancyMenu loading-screen documentation](https://docs.fancymenu.net/docs/en-US/loading-screen), [FancyMenu Essential compatibility notes](https://docs.fancymenu.net/docs/en-US/essential), [Early Loading Screen](https://modrinth.com/mod/early-loading-screen), [Essential](https://modrinth.com/mod/essential).

## Sponsored collections
CurseForge API live IDs:
- Packs: BoralancesCraft 1324682; BoralancesCraft2 1588692; BoralancesAddoned 1434970; HarderBoralancesCraft2 1596395; BoralancesVr 1423129; bonus BoralancesOceanSurvival 1726208.
- Mods: BoralancesContent 1389696; BoralancesStar 1600964; Pastbound 1668226; BoralancesOceanSurvivalCore 1726179. OceanSurvival Core is explicitly labeled separately from its modpack.
- Featured shader: BoralancesShaders on Modrinth, project quyQHxX7.
The supplied CurseForge key is encrypted in the local data folder for this Windows user. It is not embedded in source or the executable. Re-enter it in Settings on another Windows account.
Authors may restrict third-party downloads. The BoralancesVr release tested contains a restricted Potato Shader reference and cannot complete automated import. The launcher identifies the blocking project before pack downloads. Author restrictions remain respected. Get such packs/files from their provider and import an authorized local copy.

## Free wardrobe
146 original cosmetics are included. Studio 100 adds 40 capes, 40 animated Ears wings and 20 original Emotecraft animations to the existing 46-item collection. All prices are zero. Add an item to your library, then equip it for a selected instance and username. Download PNG exports a texture; Download emote JSON exports an animation.
CustomSkinLoader is downloaded only when requested and only when a compatible release exists. Local skins/capes/elytra textures do not automatically appear on other players' clients. Elytra Wings replace elytra textures when wearing elytra. Animated Wings encode genuine Ears features and a 20×16 Alfalfa wing texture into your local skin, without requiring elytra. They do not grant flight. Restore animated wings returns the exact previous skin. Existing Ears v1 and Alfalfa fields are preserved. Import a custom skin first when an offline username has no public Minecraft skin.
Import a standard non-interlaced 64×64 or 64×32 RGB/RGBA PNG skin, choose Classic or Slim, and restart Minecraft. Restore previous skin/cape/wing textures is available. Local texture writes track original files.
The 3D preview automatically loads the entered Minecraft player's real public skin. Select Public Minecraft player or Equipped local skin explicitly. Refresh bypasses the 10-minute lookup cache; concurrent requests are deduplicated. Stale responses cannot replace a newer player. Classic 64×32 skins are normalized for hat transparency and mirrored limbs; modern skins include their outer layers and wide/slim arms. Front/back controls, drag rotation and an optional turntable are available. Voucher product previews have a separate selector and cannot replace the stored player texture.
Search by name, filter by type or library, save favorites locally, or use Surprise me. The player name and favorites survive wardrobe reloads. A missing public profile has a clear message; an offline username is not assumed to own a Minecraft account.
Switch among saved Minecraft accounts from Launcher account or Cosmetics. Owned Minecraft cloaks can be loaded and activated through the authenticated Minecraft API; the launcher does not grant official cloaks.

For in-game wings, launch through Boralances Launcher once with your public player name or an imported local skin. The launcher prepares all 40 variants while preserving your original skin and restore records. Standalone exported .mrpacks include the menu, capes and emotes; wing variants require this player-specific preparation. Existing instances receive bundled client fixes before launching.

Emotes install actual version-2 Emotecraft keyframes and icons into emotes/boralances/. Restart Minecraft, open the Emotecraft menu and assign animations to wheel slots. The player preview samples the same JSON for movement and offers Replay emote. Removing an original emote restores any prior file and icon; modified files are protected against accidental replacement. Studio 100 assets are original procedural PNGs and animation JSON, with specifications in design/STUDIO100.md.

## Launcher tools
The new searchable Tools page contains 50 connected actions: ten instance tools, ten diagnostics, ten folder shortcuts, ten exports and ten preferences. Copy instances with or without worlds; ZIP backups restore as new instances. Game downloads and runtimes are excluded from backups. Rename, notes, favorites and per-instance memory/window overrides persist locally. Diagnostics include disk use, mod hashes, duplicate root Fabric IDs, missing/disabled files, recent errors, crashes, options diffs and ready manifests. Support exports redact token/password patterns and exclude configuration contents and worlds. Review any log before sharing it.
Preferences add sorting, favorite filtering, compact cards, reduced motion, larger text, launch confirmation, remembered selection, a default ready profile, disabled-content visibility and sidebar account-name privacy. The exact list is in design/LAUNCHER50.md. No launcher tool changes Firebase rules or other database branches.

## Blender design assets
Higgsfield connected Blender was used to build an editable 35-design textile collection scene. The original default scene is preserved. design/signature35-collection.png shows the collection; design/motion-contact-sheet.png shows the turntable loop. Design specification, rebuild scripts and reviewed audit results are in design/. A checkpoint copy is available at .cache/blender/signature35-final.blend. These authoring files are separate from the portable executable; the game uses standard PNG textures, rather than Blender meshes.

## Firebase accounts and admin studio
Configured project: boralancesstudios, https://boralancesstudios-default-rtdb.firebaseio.com.
Launcher account supports email/password signup, login, encrypted refresh tokens, explicit profile sync/restore and free voucher redemption. This account is separate from Microsoft Minecraft authentication.
Data is stored under boralanceslauncher/main/name/{Firebase UID}, with profile display name, preferences, free library and instance descriptions. Published servers/projects/cosmetics go under main/public. Vouchers and entitlements are separated and protected by server rules. Passwords remain in Firebase Authentication; provider keys and Minecraft tokens are never uploaded to the database.
The Admin account authenticated successfully on 11 October 2026. This PC and Windows account are enrolled as the launcher owner. Owner status is rechecked when Launcher account opens. If a portable/development copy lacks its marker, nearby launcher data folders are checked; recovery requires successful CurrentUser decryption and the same machine/account fingerprint. Only the enrollment marker is recovered, never another folder’s sign-in. Unreadable or mismatched existing markers are diagnosed and retained. First launch imports its own protected one-time sign-in; passwords are excluded from source and the executable. Admin is an alias for admin@boralanceslauncher.app.
Follow admin/SETUP.md to merge only admin/boralanceslauncher.rules-fragment.json into the existing rules document. Keep the other 24 branches and root rules. Admin studio also provides Copy branch. Do not replace the complete document with the launcher-only database.rules.json example. Rules have not been deployed and no writes were made to the live database in this change. Voucher seeds still require owner activation.
Admin studio publishes featured servers/projects, paints/imports original capes/wings/skins, and issues free vouchers. Skin products require vouchers. The publishing tools require this enrolled PC/Windows account and the matching Firebase owner UID. Database rules authorize that UID only inside boralanceslauncher; no global admin claim is created or required. Firebase authorizes accounts, not physical devices; server-side device enforcement would require a trusted backend.
Voucher codes are in admin/vouchers.txt; they require Firebase activation, are free, expire after one year and redeem once per account. Plaintext voucher codes and owner credentials are excluded from the build.
[Firebase REST authentication](https://firebase.google.com/docs/reference/rest/auth), [Realtime Database REST](https://firebase.google.com/docs/reference/rest/database), [Rules structure and inherited access](https://firebase.google.com/docs/database/security/core-syntax).

## Microsoft sign-in
The launcher uses the fixed Boralances Microsoft application and localhost callback. Players cannot supply another client ID or redirect URI. Sign in through the Microsoft button in setup or Settings. Saved sessions and provider credentials use Windows encryption and are tied to your Windows account.

Failed sign-in now reports the failed service, HTTP status and safe Microsoft AADSTS or Xbox XErr code. Settings keeps the latest report and provides Copy sign-in diagnostics. Reports contain only timestamp, stage and allowlisted error metadata; callback URLs, authorization codes, tokens, account identities and provider descriptions are excluded. Missing Xbox profiles and missing Minecraft Java profiles are distinguished from app-registration failures. A missing Java profile can mean missing Java Edition access or incomplete profile setup; it does not automatically prove that a purchase is required.
Multiple account sessions are saved encrypted; game launch refreshes the chosen account. Owned cloak actions require real authentication and ownership. The owner supplied the Boralances application ID. Live Microsoft authentication and cloak changes still require the account holder and appropriate API access.

## Development and validation
npm install, npm run runtime, npm start.
npm test, npm run check, npm run test:rules, npm run test:offline, npm run test:client, npm run test:suite, npm run test:studio and npm run test:renderer.
npm run build creates the Windows installer and portable executable. node scripts/verify-build.cjs extracts its actual application payload and compares final source/assets.
Ordinary menu text is no longer selected by dragging. Inputs, exported rules and logs remain copyable, using a theme accent instead of the blue system selection. Previews pause offscreen, in hidden windows and during game play; reduced motion disables idle rotation.
Renderer tests use Chrome with explicit IPC fixtures and live catalogs; they do not establish native Electron IPC success. See VALIDATION.md for results and remaining runtime checks.
The application is unsigned. Third-party mods retain their authors' licenses and download directly from the providers; no third-party client mod JARs are redistributed.

## Liquid Glass components
The launcher uses accessible native checkbox switches with a raised convex lip and concave inner track, refraction maps generated on Canvas and SVG backdrop filters. Dark/Light keep their own colors; unsupported browsers use blur, reduced transparency disables optics, and filters pause while Minecraft runs.
Open design/liquid-glass/components.html for the complete single-file offline prototype: switches, a searchable collection, native sliders and a draggable spherical magnifier with separate edge and central maps. Bezel width, thickness, glass index, strength and zoom are commented and adjustable. No external assets are needed.

Hold a Liquid Glass switch or drag a slider to magnify the backdrop inside its moving thumb. No separate bubble is created. Native slider values, keyboard controls, dialogs and reduced preferences are preserved. Release, cancellation, focus loss and theme changes clear the magnification. RAM allocation includes 2/4/8/16 GB presets, a hardware-based suggestion, reset to 4 GB and a warning when too little RAM remains for Windows. Save settings applies the allocation.
Game memory now uses a native range slider (1–64 GB, 256 MB steps), with exact GB/MB output and saved allocation. Chat uses the same controls for its existing blur, frost and other range settings; browsers do not allocate Minecraft RAM.
The original chat HTML at C:/Users/Bora/Documents/GitHub/web1/chat.html has been updated only inside the existing physical-glass block. The launcher injects the same controls into embedded chat without an external browser. This does not deploy the hosted website.

Owner enrollment uses CurrentUser Windows DPAPI. If PowerShell cannot read it, the bundled native Windows reader retries the same encrypted marker and machine/user identity. Launcher account and Admin studio offer Retry owner check; publishing still requires the matching Firebase owner login and launcher branch rules. Installed builds can recover only a verified enrollment from known nearby/desktop portable folders, without importing sign-in sessions.

## 1.6.4 visual and owner update
The installer includes original emerald artwork, a branded welcome page and refined wizard colors. Switches now use 64×38 tracks and 30px thumbs; slider lenses are 36px with stronger held zoom. A single optical sidebar highlight follows hover, keyboard focus and the active page, with scroll support at smaller window heights. Optical layers stop during gameplay and respect reduced motion/transparency.
Windows 11 22H2 and newer use native acrylic with slightly translucent theme backgrounds; other systems use an opaque fallback. [Electron window material](https://www.electronjs.org/docs/latest/api/browser-window/) and [NSIS branding options](https://www.electron.build/docs/nsis/) document these platform features.
Retry Windows owner check is visible only to the signed-in configured Firebase owner account. That public UID controls recovery UI visibility and grants no privilege; publishing still requires a verified Windows enrollment and matching authenticated Firebase session. The original private markers were bound to the coding execution context. After explicit user approval, encrypted backups were preserved and this PC was enrolled in its actual Windows launcher context. Hidden native Electron verification confirmed ownerPC=true, signedIn=true and admin=true. No cloud publishing or Firebase rule changes were performed.

## 1.6.5 game overlays and concurrent instances

The bundled client overrides its own vanilla background/blur pass so F9 wardrobe, F7 widget placement and F4 embedded chat render sharply. Generated screen adapters execute content and widget rendering without a background pass on all four audited versions (26.3, 1.21.11, 1.21.1, 1.20.1). Minecraft’s global blur preference stays untouched. All four ready packs contain client 1.6.5; launching an existing bundled-client instance replaces its older addon before skin preparation. Restart the game using this launcher update to load the new addon.

Different instances can run concurrently. Select another instance and press Play. The same instance cannot be started twice, running files stay protected, Stop affects the selected instance, and live logs are filtered by instance. Each game receives an independent authenticated loopback chat bridge and offscreen view; closing one does not interrupt the others. Startup/download operations are still serialized.

The sidebar lens now tracks scrolled rows and keyboard focus with stable dimensions and bounded refraction. The same lens and larger glass controls are included in the embedded BoralancesChatting view and the local web1/chat.html integration. The public chat website has not been deployed.

Verification covers executable adapter fixtures and real child-process lifecycle checks, not a playable Minecraft session. Screen background/widget behavior follows [Fabric custom-screen documentation](https://docs.fabricmc.net/develop/rendering/gui/custom-screens).

## 1.6.6 held magnifier size

Switch and slider thumb lenses grow to 170% of their resting diameter while held, and shrink back on release or cancellation. Their centers stay anchored through switch movement and slider dragging, including keyboard holds. Local SVG filter dimensions preserve optical alignment during the growth transform. The same behavior is included in embedded chat, the local chat source and the standalone component prototype.

## 1.6.7 guided setup and download page
The installer uses refreshed emerald glass artwork, a required MIT License acceptance checkbox, a folder chooser, and a launch option at completion. The matching uninstaller is available through Windows Installed apps, the Boralances Launcher Start menu folder, or Uninstall Boralances Launcher.exe in the installation folder. Normal uninstall preserves %APPDATA%/BoralancesLauncher/data; portable folders remain separate.

The self-contained download page is generated by scripts/download-page.cjs using verified release metadata. Its relative downloads/ link points to a colocated installer, with the exact size and SHA-256 checksum. The MIT License is provided beside the download. This prepares local website assets; it does not deploy the chat website.

## 1.6.8 connected sign-in and creators
A Boralances Firebase account or a server-verified BoralancesChatting account is required to use launcher operations. The main-process IPC gate enforces this independently of the navigation UI. Login, account state, embedded chat, window controls and stopping a running game stay accessible while signed out. Minecraft authentication and owner/admin verification remain separate.

Firebase refresh credentials remain encrypted in cloud-session.json. A verified chat session is additionally saved through Windows safeStorage encryption in chat-session.json. Startup restores the saved profile and rechecks the chat service; an explicit sign-out or server revocation clears it. The trusted chat site still validates session expiry and password changes. In-game views share the persistent chat partition and receive the current token in their own in-memory session. Token renewal propagates to existing game views; signing out clears all live chat views. This avoids a repeated login while the saved session remains valid, rather than bypassing service authentication.

Featured Creators groups the authors of available curated projects from CurseForge/Modrinth metadata, links to their profiles and shows unavailable-project counts. The installer adds a native review step and refreshed connected-play branding. integrations/website contains the staged homepage with BoralancesProjects category tabs, a sidebar link to the download page and an explicitly unfinished BoralancesBrowser page. These files are copied beside chat.html; deployment remains separate.


## Launcher 1.6.9 updates and glass

Settings now includes a launcher updater: check on startup, check manually, download a release, cancel, and install/restart after all games have closed. The release feed is at the website's downloads/launcher-update.json path. It is authenticated with the public Ed25519 key packaged in src/update-public-key.cjs. Each download and the assembled application are checksummed. Saved accounts, instances and owner enrollment stay in their existing data directory. Portable updates replace the executable at its original path and retain a versioned rollback executable. Installed copies use the existing guided installer/uninstaller.

Build the Windows app, verify it, then run npm run build:web to produce the small installer, application parts, portable update parts and signed feed. Deploy the generated website downloads before online updates are available. All public parts remain below 24 decimal MB. Existing version 1.6.8 must be upgraded to 1.6.9 once to gain the built-in updater.

Keep a secure backup of .release-keys/launcher-update-private.pem. It is ignored by Git and excluded from packages and website assets. Future releases must use the same key; do not publish this private file or clear it when cleaning build caches. Windows code signing is separate; the launcher executables remain unsigned.

Liquid Glass now has a persistent optical selection lens with elastic movement, smooth retargeting during rapid clicks, specular surface highlights and refined rims. Optical effects pause during games and obey reduced transparency; lens travel obeys reduced motion. The website homepage retains its requested six-item topbar and original cyberpunk styling.

The refined sidebar uses an elliptical zoom field so the magnifier covers the label rather than only a small central circle. Visible panels and content cards now receive bounded physical edge refraction. Native Windows acrylic and expensive optical effects pause while Minecraft is running; the lightweight selection travel remains available.

## 1.6.10 pointer glass

Moving the mouse over sidebar items now reveals a second glass lens without opening a different page. Empty sidebar space shows a bounded round lens and a soft moving light. The selected page retains its own glass highlight. Pressing the pointer lens adds a subtle expansion, and leaving the sidebar clears the hover effect. Keyboard focus, reduced motion/transparency, and gameplay performance fallbacks remain active. Pointer movement reuses optical maps instead of regenerating them for every cursor position. Cards, search and compact controls also gain pointer reflections. The same sidebar interaction is included in the local chatting page and in the launcher's embedded chat, including pages with an older selected-row lens.

## 1.7.0 glass and shared wardrobe

Liquid Glass uses a smooth squircle bevel and directional rim light, informed by [Kube's CSS/SVG article](https://kube.io/blog/liquid-glass-css-svg/). Settings offers live lens intensity, edge lighting, bounded detail presets, pointer-following and motion preferences, plus reset. Intensity and light changes reuse the displacement maps. Reduced transparency and game performance fallbacks remain active; chatting receives the same optical improvements.

The free collection now contains 187 originals, including 25 hats, 10 trinkets, five dresses and a free starter skin. These forty wearable designs occupy Minecraft's outer skin layers; they are pixel artwork on the player's model, not arbitrary tall meshes. Cape, elytra, animated wings, hat, trinket and dress have independent selections in the launcher and F9 menu. Their base skin and Ears data are preserved. Export styled skin produces a PNG for manual upload to an owned Minecraft account.

Optional shared wardrobe uses [CPM's plugin state messages](https://github.com/tom5454/CustomPlayerModels/wiki/API-documentation). Install sharing from Cosmetics, enable Share my cosmetics, and join a server with CPM. Receiving players need CPM, Boralances Client and its Ears provider; the server needs CPM's mod or compatible plugin. Custom capes, wings and outfits cannot appear to unmodified clients automatically. Shared packets contain validated textures, never account tokens or image URLs; CPM supplies the sender UUID. Show other players' cosmetics can be disabled. The included native client supports Fabric 26.3, 1.21.11, 1.21.1 and 1.20.1. Other launchers/loaders and vanilla clients do not gain that renderer.

Ready instances adds official Vanilla quick installation for these four versions. The new-instance dialog offers stable releases, snapshots, alpha/beta and all versions. The owner-authorized CurseForge default credential is bundled in the main process; a personal encrypted override is optional and never cloud-synced. Author download restrictions remain enforced.

Admin studio adds published-item search, editing, unpublishing, encrypted local drafts, an eraser and stroke undo/redo. Hat/trinket/dress painting and publication enforce the relevant outer UV regions. Publishing and deletion still require the enrolled owner's matching Admin account, and use only the existing boralanceslauncher branch. This release changes no Firebase rules or other application branches.

## 1.7.1 imports and glass refinement

When a CurseForge pack references an author-restricted file, import preflight searches public Modrinth releases. An identical SHA-1 file is preferred, including a matching secondary file. Otherwise the importer checks project identity through matching names and source repositories or a CurseForge backlink, then selects a release supporting the pack's Minecraft version and loader. It prefers a matching release name/filename, then a stable compatible release. A compatible replacement may differ from the original pack pin; the import report identifies that case. Ambiguous/unverified projects, incompatible client releases and missing alternatives are listed without installing a partial instance. API authentication and arbitrary download failures do not trigger this fallback, and no blocked CurseForge CDN URL is guessed or used.

Modrinth required dependencies are planned and checksummed. Batched hash lookup identifies dependencies already pinned in the CurseForge manifest, avoiding duplicate JARs and preserving compatible exact pins. Conflicts stop preflight. Successful imports show a report, save pack-import-report.json, and label replacement provenance in Installed content. Individual restricted CurseForge downloads outside pack imports still require manual import.

Liquid Glass adds a softly lit rim beneath a crisp specular edge, subtle warm/cool reflections and pointer-directed surface lighting. The zoomed lens center stays sharp while its bevel receives a small optical blur. Identical geometries share an LRU cache capped at 16 entries and 1.5 million map pixels. Large magnifiers now use matching refraction/zoom resolutions at every quality level. Clarity and lighting changes update filter properties without rebuilding pixel maps. Launcher, chatting and the standalone component prototype use the same updated optics; reduced-transparency and gameplay fallbacks remain active.

## 1.7.2 local multiplayer and controls

Offline launches keep Minecraft's Multiplayer menu available, including Direct Connection for localhost, LAN and servers configured to accept offline profiles. Imported launch profiles cannot disable that menu for offline launches. The bundled Fabric client applies an offline-only menu permission correction for 26.3, 1.21.11, 1.21.1 and 1.20.1. It requires the launcher's offline marker, token and matching OfflinePlayer UUID; Microsoft launches retain their original account permissions. Server authentication, account ownership and Realms access are unchanged. Restart an instance through the updated launcher to apply the fix; existing ready-instance addons update at launch.

Switches show ON/OFF states with clearer hover and disabled feedback. Sliders use the same geometry for the native input and glass thumb, show a live value while held or keyboard-focused, and follow resizing and right-to-left layouts. RAM labels include GB and MB. The large held magnifier stays on the moving thumb. Dark and Light themes retain press feedback with no optical refraction. The shared controls are also included in the local BoralancesChatting theme.

## 1.7.3 Microsoft sign-in diagnostics

The installed authentication library indexes token fields before checking several service error responses. An Xbox authorization error such as missing Xbox profile can therefore appear as KeyError. The backend now checks each response before the library reads it, retaining its existing PKCE and authentication protocol. It reports Microsoft app/redirect/scope errors, Xbox account requirements, explicit Minecraft app-registration rejection, network failures and missing Java profiles separately. Unknown service rejection is not automatically called an app-approval problem. Refresh replies may retain the previous refresh token when no replacement is supplied. Browser callbacks validate state and destination, report cancellation, and no longer imply authentication completed before the backend verifies it.

Use Settings → Microsoft account → Sign in with Microsoft for a fresh attempt, then Copy sign-in diagnostics if it fails. Earlier 1.7.2 generic errors cannot be reconstructed because raw authentication responses are deliberately not stored. Live sign-in must be retried by the account holder to identify that attempt's underlying cause.

## 1.7.4 update handoff and Microsoft defaults

Launcher updates now stage their Windows helper outside the application folder and wait for a validated startup acknowledgement before quitting. Installed updates show the interactive setup wizard. Cancelled or failed setup records recovery guidance and reopens the existing launcher; portable updates retain their verified replacement and rollback behavior. Close Minecraft before applying an update.

The public Microsoft application ID d170656f-f05d-48a4-9a2d-e8ad156ae01f is fixed for all sign-in and refresh requests. Existing custom IDs and incoming settings overrides are ignored. The application registration and Minecraft API access must still be configured by its owner; embedding the ID does not grant approval or game ownership.

The root microsoft-identity-association.json contains this application ID. scripts/stage-microsoft-identity.ps1 copies it into the local website .well-known directory. Deploy that website, then use https://boralances.boranil400.workers.dev/.well-known/microsoft-identity-association.json for publisher-domain verification. Creating the file alone does not publish it or complete verification.

The update bootstrap uses Windows Start-Process to create an independent hidden PowerShell console, rather than Node DETACHED_PROCESS, which was reproduced exiting immediately on this PC. A real child launcher fixture exits after acknowledgement; the helper then finishes native setup successfully after that parent is gone.

## 1.7.5 first-run experience

Let’s customize your experience appears before first use for each Boralances or BoralancesChatting identity on this Windows account. Sign in, preview Liquid Glass/Dark/Light, then choose Offline, Online or Both. Offline requires an explicitly chosen valid Minecraft username; Online requires a saved or newly authenticated Minecraft Java profile; Both requires both. Failed or cancelled Microsoft sign-in keeps setup open, with safe diagnostics and a route back to Offline.

Theme and play-mode progress persist in data/onboarding.json, keyed by a hash of the launcher identity. It stores no credentials. Login tokens continue to use the existing encrypted stores. Completed setup is remembered, and Settings → Customize experience runs it again. Missing Minecraft login in an Online/Both setup returns to the profile step. Main-process IPC guards block launching and content changes until setup is complete, and the selected mode determines the available launch profiles.

Microsoft client ID and callback fields have been removed. The launcher always uses the Boralances registration and fixed localhost callback, including when older settings files contain overrides.


## 1.7.6 Liquid Glass Lab controls

Switches, sliders and held magnifiers now adapt the local Liquid Glass Lab reference supplied by the owner. Wide white pills become transparent glass on press; a smootherstep convex-to-concave lip shapes the switch thumb, and slider pills combine squircle edge refraction with an elliptical center zoom. Held lenses remain 1.7 times larger and spring back around their own center. Sidebar hover and press animation use the same spring timing.

Switches drag continuously and commit at the halfway point. A cancelled gesture restores the saved value. Native clicks, Space, range keyboard steps, disabled states, RTL layouts and live RAM values are preserved. Native and optical slider thumbs share a 68 by 42 pixel footprint. Reduced motion/transparency and flat themes retain accessible fallbacks. The launcher and local chat integration use the same controls without external fonts or runtime dependencies.


## 1.7.7 catalog and Android preview

Discover searches all five categories even before an instance exists. Match selected instance can be turned off to browse other versions; file installation still requires a compatible selected instance. Datapack search uses the current all_project_types facet, removing the obsolete mod/category restriction. Named queries use relevance sorting, and searches/release lists use Electron networking so Windows proxy configuration is respected.

The separate native Android preview lives in release/android/. It targets Android 12–16 with ARM64/x86-64 native Java execution, touch/gamepad controls, loader installers, five content categories, encrypted saved Boralances/Minecraft accounts and eleven device presets. See android/README.md for setup, source provenance, 4 KB/16 KB page-size limits, and desktop features not included in the mobile preview. The signed APK and core logic were verified on the build PC; phone gameplay and Microsoft account login have not been verified.


## Ready client 1.8.1

F9 opens the Boralances client home screen with wardrobe, cosmetic favourites, HUD presets, accent colours and performance tools. F7 opens full-screen widget placement; Widget settings exposes styles and visibility, Arrange returns to placement, Save commits and Escape cancels. Editor and live widget positions share the same viewport. Wide screens use a navigation rail and player preview; smaller GUI scales retain compact tabs and vanilla keyboard navigation.

Fresh ready packs include refined title/loading artwork and rounded buttons. Existing Windows ready instances update their bundled client when launched. Known stock design files upgrade with backups; edited layouts and video preferences remain intact. Android applies the equivalent upgrade only to marked ready instances and backs up older client JARs. These changes do not certify every mod combination or phone GPU.


## Ready presentation 1.8.2

The title screen now has an original lantern-lit voxel landscape, a centered Boralances mark, stacked glass buttons and a compact row retaining Minecraft language, accessibility, settings and quit actions. The native client menu uses lighter translucent panels and rim highlights. Android shares the mint/teal identity through native glass cards, a floating navigation dock, a scenic hero and motion-aware button presses. Runtime menus stay crisp and avoid an expensive full-screen refraction pass. Original generated-art provenance and the prompt are saved under design/menu-scenes.
