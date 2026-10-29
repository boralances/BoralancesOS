# Build and deployment

## Builder

Use x86_64 Linux with Nix and flakes enabled. Provision at least 8 GB RAM and approximately 80 GB free disk for the full gaming image set; custom kernel builds may need more. Raw/VDI generation uses the NixOS VM disk builder and normally requires `/dev/kvm`; a remote Nix Linux builder is another option. A Windows `.exe` cannot stand in for a bootable Linux distribution.

The nixpkgs revision is fixed in `flake.nix` and the Nix-generated `flake.lock` is included. Builds use `--no-update-lock-file`. To update, change the revision intentionally, regenerate the lock and run the validation matrix.

Build from a clean extracted source ZIP or Git checkout. Do not add local profiles or developer caches to the source tree. With a Git flake, add new configuration files to Git before building because untracked files are omitted.

```bash
python3 scripts/validate.py
nix flake check --no-update-lock-file
bash scripts/build.sh all
```

| Build target | Expected payload |
|---|---|
| `installer-iso` | Hybrid EFI/BIOS ISO, graphical desktop and mounted-target installer |
| `live-iso` | Hybrid EFI/BIOS ISO, volatile live desktop |
| `persistent-iso` | Hybrid ISO requiring external `BLPERSIST01` ext4 storage |
| `usb-image` | GPT raw disk image with EFI System Partition and persistent ext4 root |
| `virtualbox-image` | UEFI VDI, guest additions, Linux 6.18, low-effects auto profile |
| `browser` | Native Linux QtWebEngine browser package |
| `launcher` | Linux-adapted original Electron launcher package |

Outputs are collected under `out/<target>/`, alongside `out/flake.lock` and `out/SHA256SUMS`. Image output names may include NixOS metadata according to the pinned builder. Filesystem timestamps/boot metadata can still prevent byte-identical disk images; validate reproducibility rather than assuming it from declarative input alone.

## Install to a computer

1. Write the installer ISO using a trusted image-writing application after checking its SHA256. Select its UEFI entry in firmware.
2. Connect to the internet using the network editor or `nmtui`. The installation path currently resolves/builds the installed closure and is **not an offline installer**.
3. Use the partitioning tool of your choice. The recommended layout is a 1 GiB FAT32 EFI System Partition mounted at `/mnt/boot` and an ext4 or Btrfs root mounted at `/mnt`. Disk encryption can be configured through generated hardware configuration; it is not automatically created here.
4. Open **Install BoralancesOS** from the welcome window for the graphical flow, or run `sudo boralances-install` for the terminal flow. The GUI reviews the mounted filesystems, region, appearance and effects; an explicit consent checkbox enables installation. It passes the reviewed device identities to the backend, which rejects a changed destination. The terminal flow requires the exact text `INSTALL BORALANCESOS`. Neither flow chooses, partitions or formats a disk automatically.
5. The installer copies the source, generates the real hardware module and installs `#workstation`. The terminal path asks for the new `bora` password before completion; the GUI path uses first-boot password enrollment. Reboot only after installation succeeds.

There is no default installed password, root autologin or installed passwordless sudo. Live autologin/passwordless sudo belong only to live media. The graphical installer has six pages, actual process-driven busy progress and expandable details. It offers GParted as a separate disk utility; a future automatic partitioning flow would require its own clearly reviewed disk plan.

Update an installed system from its source directory:

```bash
cd /etc/nixos/boralances
sudo nixos-rebuild test --flake path:.#workstation
sudo nixos-rebuild switch --flake path:.#workstation
# Recovery: choose an older generation in systemd-boot, or:
sudo nixos-rebuild switch --rollback
```

## Persistent live USB

ISO9660 cannot store new writes. The persistent ISO keeps its base squashfs read-only and puts the overlay upper/work directories on a separate **ext4** volume labelled `BLPERSIST01`. It also bind-mounts persistent home, Nix database/profile state, NetworkManager, Bluetooth, Flatpak and NixOS mutable state. No persistence volume means this specific ISO intentionally fails boot; the ordinary live ISO is the volatile fallback.

The least ambiguous setup uses two devices: the persistent ISO written to one USB stick and an empty ext4 partition on another. A combined partition layout can be prepared with a tool that supports adding partitions after hybrid ISO data, but this repository does not assume that every image writer does so. A writable USB raw image avoids this complication entirely.

Prepare an already-created, already-formatted and unmounted **empty partition**:

```bash
sudo bash scripts/persistence-volume.sh /dev/disk/by-id/your-device-part1
```

The script refuses whole disks, mounted/non-ext4/nonempty volumes and duplicate labels. It only labels the selected partition; it does not repartition or format. Use a sufficiently large volume (32 GB recommended for games/Flatpak). Keep only one matching label connected at boot.

The live overlay must remain paired with its exact ISO build: package database and lower-store assumptions depend on that base. Do not reuse it across a different ISO version. Persistent live saves user-installed packages/profiles and listed application state; the booted declarative OS remains the ISO generation. For kernel/system-generation upgrades and complete writable-root behavior, use the portable raw image or a normal installation. Persistent live is not encrypted by default.

Validate persistence by creating a note/bookmark, saving a Wi-Fi connection, installing a small user package, rebooting twice and checking each item. Also test an unclean shutdown and a full volume before release.

## Writable portable USB image

Write the raw image from `out/usb-image/` to a USB device with an image writer that supports raw disk images. Verify the exact destination device before writing. The image contains a FAT32 ESP and ext4 root; root growth is configured for first boot. The image builder installs a removable UEFI boot path. There is no live overlay: home, apps, package state and OS generations live on the USB filesystem.

At first boot a local terminal asks you to set the `bora` password before greetd starts. Later boots show the login prompt. Test this enrollment and removable-media boot path before distributing an image.

## VirtualBox

Create a 64-bit Linux VM with EFI enabled, **VMSVGA**, at least 4 GB RAM, two virtual CPUs, 128 MB display memory and a SATA/AHCI controller. Attach the VDI or installer ISO. Native hardware drivers remain available for virtio/NVMe and USB use outside VirtualBox.

Guest modules and the `VBoxService` package are bundled, with the service conditioned on Oracle virtualization. The VirtualBox image chooses Linux 6.18 and automatically reduces effects. Start with 3D acceleration enabled; compare with it disabled if the host driver is unstable. Guest additions cannot turn a virtual GPU into a native gaming GPU.

Shared-folder and resizing behavior, including `VBoxClient --vmsvga-session`, must be checked on the actual host/guest version. Clipboard support is enabled, but Wayland integration depends on the VirtualBox release. Seamless mode and drag-and-drop are disabled. The user is in `vboxsf`; mount selected host shares explicitly, with appropriate permissions.

## CI

`.github/workflows/build.yml` performs source checks and Nix evaluation/checks on a hosted Linux runner. Its manual image job requires a self-hosted runner labelled `linux`, `x64`, `nix-builder` with enough disk and KVM. The exact lock from validation is passed to the build job. No workflow execution, repository creation, external upload or release publication has been performed from this workspace.

Before a public release, pin third-party Actions to reviewed commit SHAs, scan final image closures/licenses, sign checksums using an external release key and run the acceptance matrix. Signing keys belong outside the repository and images.
