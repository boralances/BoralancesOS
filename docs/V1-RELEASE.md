# BoralancesOS V1 build notes

The live/installation image is `BoralancesOS-V1-Live-Installer-x86_64.iso`:

- Use the size and SHA-256 in the manifest shipped beside the actual image.
- x86-64 live boot supports UEFI and BIOS; the installer targets UEFI.
- Boot choices include VirtualBox/compatibility, native AMD/Intel, and native
  NVIDIA with the open kernel driver for supported GTX 16 / RTX 20 or newer GPUs.
- Secure Boot signing is not configured in this build.

The VirtualBox ZIP contains an OVA with a **blank**, dynamically allocated
40 GiB disk. It requires the separate ISO; it is not a preinstalled OS export.
Its defaults are 4 GiB RAM, two CPUs, EFI, VMSVGA, USB xHCI and microphone input.
It contains no personal account, password or saved session. Create your account
in the installer, then shut down and detach the ISO before booting the installed
system. Keep enough host disk space for the installed system to grow.

## Verification

The installed reference VM was checked for normal 1280×800 scaling, theme
persistence across reboot, desktop service startup and application navigation.
BoralancesBrowser's Tor mode reached the Tor Project check with `IsTor: true`;
stopping Tor blocked subsequent requests instead of falling back to a direct
connection. Automated source regression checks and release reconstruction /
low-space checks passed. The Windows run skips the POSIX-only file-mode test.

The V1 ISO reached the live desktop on an unattended normal reboot in the
separate VirtualBox verification VM. BoralancesBrowser rendered its start page,
and the installer reached its account page. Dock mouse interaction has not been
fully verified. A complete installation onto the blank verification disk has
not been tested. Native NVIDIA,
AMD, USB Wi-Fi and physical microphone hardware have not been tested in this
build. VirtualBox exposes a virtual GPU and NAT Ethernet; installing a driver
inside it does not expose the host's physical NVIDIA GPU or Wi-Fi adapter.
NVIDIA's Windows App is not bundled; Linux GPU controls use the hardware center,
`nvidia-settings` where supported, and monitoring tools.

## Publication

Release files are local until explicitly published. `prepare-release.py` splits
the ISO into 23 MB parts and generates SHA-256 values plus resumable download
helpers. Upload these as GitHub Release assets, not as source commits. Set the
manifest's `published` flag only after the download URLs actually work. The
website keeps the ISO download disabled until then. See [GITHUB.md](GITHUB.md).

Original project source is MIT-licensed. Dependencies retain their licenses;
see [THIRD-PARTY.md](../THIRD-PARTY.md).
