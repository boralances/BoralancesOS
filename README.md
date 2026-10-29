# BoralancesOS V1

A NixOS-based Linux desktop with a Wayland workspace, an original Liquid Glass
theme, movable desktop widgets and a graphical live installer.

Optimization mode is the fresh-install default. Liquid Glass adds translucency
and animations; selected appearance settings persist between sessions. VirtualBox
uses explicit 100% scaling to avoid oversized interfaces caused by synthetic DPI.

Included tools cover browsing, files, terminals, GPU/device controls, audio,
containers and gaming launchers. BoralancesBrowser has a separate Tor-routed
window with live proxy readiness checks. This mode does not provide all of Tor
Browser's fingerprinting protections. Windows executables use Wine; AppImages
are supported. Compatibility depends on the individual application and hardware.

The V1 live/installation image offers VirtualBox compatibility, native AMD/Intel
and native NVIDIA boot profiles. The installer creates your own username and
password. The small VirtualBox OVA is an **installation kit with a blank disk**:
attach the separate ISO before starting. It contains no personal account.
VirtualBox presents a virtual GPU; native NVIDIA/AMD rendering requires a native
installation or a separately configured passthrough-capable virtualization host.

## Build and contribute

Use x86_64 Linux with Nix flakes, the committed dependency lock, at least 8 GiB
RAM and ample storage (60 GiB recommended for a single image build).

```sh
python3 scripts/validate.py
nix build --no-link .#checks.x86_64-linux.browser-tests
bash scripts/build.sh installer-iso
```

For a low-copy V1 build on a dedicated builder, run
`sudo bash scripts/build-v1-release.sh`. The ISO remains in the Nix store through
`/var/lib/boralances-build/v1-iso`; copy it to your chosen export location once.
On Windows, `scripts/build-virtualbox-kit.ps1` creates the separate blank-disk kit.

See [GitHub Actions and build requirements](docs/GITHUB.md),
[contribution guidelines](CONTRIBUTING.md), [third-party notices](THIRD-PARTY.md)
and the [MIT license for original source](LICENSE).

Generated ISOs, OVA exports, virtual disks and local account/hardware files stay
outside Git. Publish images as release assets; the website helpers support
SHA-256-verified download parts smaller than 25 MB. Source availability does not
mean an image has been published or tested on every physical device.

