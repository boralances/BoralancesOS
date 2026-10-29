BORALANCESOS V1 — VIRTUALBOX INSTALL KIT

This kit contains a new, blank 40 GiB virtual disk and VM configuration.
It is not a preinstalled OS and contains no personal account or saved session.
Download the separate V1 live/installation ISO before starting.

Windows quick start
1. Install Oracle VirtualBox on an x86-64 Intel/AMD host.
2. Extract this ZIP into a folder.
3. Drag the assembled V1 ISO onto Start-BoralancesOS.cmd.
4. Choose the first, VirtualBox / compatibility boot entry.
5. Open Install BoralancesOS. Choose your name, username and password.
6. Choose the blank 40 GiB virtual disk, review the plan, and install.
7. Shut down, remove the ISO from the virtual optical drive, and start the VM.

Manual setup / Linux hosts
Import BoralancesOS-V1-VirtualBox.ova in VirtualBox. Enable "Import hard drives
as VDI" when offered. Attach the V1 ISO to the empty optical drive, then start.
The tested defaults are EFI, 4 GiB RAM, 2 CPUs, KVM paravirtualization,
HPET off, VMSVGA with 128 MiB VRAM and 3D acceleration, and 1280 x 800.

The dynamically allocated disk grows as you install software; 40 GiB is its
capacity, not the initial download size. Allow room for the installed system
on the Windows/Linux host. Included applications need substantially more disk
space than this small blank-disk kit.

The guest sees a virtual graphics adapter and NAT Ethernet. Installing the
host NVIDIA or AMD driver in the guest does not pass through the physical GPU.
Use a native PC installation for NVIDIA/AMD Vulkan rendering and Unreal.
Microphone input and USB adapter passthrough are controlled in VirtualBox.
Automatic guest display blanking is disabled in Oracle guests; Win+L still
locks the desktop. Native installations retain automatic idle locking.

No universal hardware, Windows-app or game compatibility is promised.
Check SHA-256 values against the V1 release manifest before using downloads.
