#!/usr/bin/env bash
# Initialize an ALREADY FORMATTED, EMPTY ext4 partition; never repartition a disk.
set -euo pipefail
[[ $EUID -eq 0 && $# -eq 1 ]] || { echo 'Usage: sudo bash scripts/persistence-volume.sh /dev/disk/by-id/...-partN' >&2; exit 2; }
partition=$(readlink -f -- "$1")
[[ -b "$partition" ]] || { echo 'Not a block device.' >&2; exit 2; }
[[ $(lsblk -dn -o TYPE "$partition") == part ]] || { echo 'Choose an individual partition, not an entire disk.' >&2; exit 2; }
[[ $(blkid -s TYPE -o value "$partition") == ext4 ]] || { echo 'Partition must already be formatted as ext4.' >&2; exit 2; }
if findmnt -rn -S "$partition" >/dev/null; then echo 'Unmount the partition first.' >&2; exit 2; fi
if [[ -e /dev/disk/by-label/BLPERSIST01 && $(readlink -f /dev/disk/by-label/BLPERSIST01) != "$partition" ]]; then
  echo 'Another BLPERSIST01 volume already exists. Disconnect it first.' >&2; exit 2
fi
lsblk -o NAME,SIZE,FSTYPE,LABEL,MODEL "$partition"
read -r -p 'Type LABEL BORALANCES PERSISTENCE to label this partition: ' answer
[[ "$answer" == 'LABEL BORALANCES PERSISTENCE' ]] || exit 1
temporary=$(mktemp -d)
cleanup() { mountpoint -q "$temporary" && umount "$temporary"; rmdir "$temporary"; }
trap cleanup EXIT
mount -o ro,noload "$partition" "$temporary"
if find "$temporary" -mindepth 1 -maxdepth 1 ! -name lost+found -print -quit | read -r _; then
  echo 'The partition is not empty. Refusing to label it for persistence.' >&2; exit 2
fi
umount "$temporary"
e2label "$partition" BLPERSIST01
echo 'Ready. Boot the persistent ISO with this volume connected. Keep this volume paired with this exact ISO build.'
