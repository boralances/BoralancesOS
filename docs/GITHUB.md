# GitHub builds and contributions

The MIT license covers original BoralancesOS source. Dependencies and bundled
projects retain their own licenses; see THIRD-PARTY.md. Steam and NVIDIA's
proprietary components are not relicensed under MIT.

Pushes and pull requests run Python/JavaScript checks, evaluate the locked Nix
configurations in separate jobs and build only the small browser test derivation.
Evaluating every image in one process can exceed a small VM's memory.
Configuration metadata
must discard Nix string context: otherwise printing a system derivation path
unintentionally makes validation download/build the entire system.

The failed run 40833256037 exhausted the hosted runner's storage in the
`checks.x86_64-linux.configurations` dependency closure. The Node.js 20 message
was a separate warning. Checkout v5, upload-artifact v6 and download-artifact v7
use Node.js 24; self-hosted runners must be version 2.327.1 or newer.

Full images are built only through **Actions → Validate and build BoralancesOS →
Run workflow**, using a trusted Linux x86_64 runner with the `nix-builder` label,
Nix flakes enabled, at least 8 GiB RAM and ample free disk space (60 GiB recommended). This is not
an ordinary GitHub-hosted 14 GiB image-build job. Do not run untrusted fork PR
code on that runner. Commit the reviewed flake.lock; CI does not generate it.

Run locally on Linux:

```sh
python3 scripts/validate.py
nix flake check --no-build --no-update-lock-file
nix build --no-link .#checks.x86_64-linux.browser-tests .#checks.x86_64-linux.configurations
bash scripts/build.sh installer-iso
```

Keep ISOs, virtual disks, OVA exports, temporary build shares, local hardware
configuration, passwords and account files out of Git. Store downloadable
images as release assets, not source commits. The website downloader supports
SHA-256-verified image parts below 25 MB. A public repository alone does not
publish or create an installation image.

Prepare small release assets after exporting and boot-testing the ISO:

```sh
python3 scripts/prepare-release.py --iso out/V1/BoralancesOS-V1-Live-Installer-x86_64.iso --kit out/V1/VirtualBox/BoralancesOS-V1-VirtualBox-Kit.zip
```

Upload the contents of `out/V1/Release` to a GitHub **Release** tagged
`boralancesos-v1`; do not commit the multi-gigabyte image parts to source history.
Each ISO part is 23 MB. The command prepares files only and preserves an existing
different part instead of overwriting it. Verify all assets are publicly available
before setting `published` to `true` in the release/website manifest. Until then
the website leaves the ISO download disabled. The static VirtualBox kit is
available separately and still requires the ISO.
