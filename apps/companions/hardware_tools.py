"""Explicit native-GPU setup and Unreal guidance, without pretending apt is NixOS."""
import json,os,re,shutil,subprocess,sys
from pathlib import Path

UNREAL_URL='https://www.unrealengine.com/en-US/linux'
GUIDE_URL='https://dev.epicgames.com/documentation/unreal-engine/linux-development-quickstart-for-unreal-engine'

def graphics_devices(root=Path('/sys/bus/pci/devices')):
    result=[]
    for item in root.glob('*'):
        try:
            if int((item/'class').read_text().strip(),16)>>16!=3:continue
            result.append({'address':item.name,'vendor':(item/'vendor').read_text().strip(),'device':(item/'device').read_text().strip()})
        except (OSError,ValueError):continue
    return result

def pci_bus_id(address):
    match=re.fullmatch(r'([0-9a-fA-F]{4}):([0-9a-fA-F]{2}):([0-9a-fA-F]{2})\.([0-7])',address)
    if not match:raise ValueError('Invalid PCI address')
    domain,bus,device,function=(int(part,16) for part in match.groups())
    return f'PCI:{bus}@{domain}:{device}:{function}'

def nvidia_module(devices,open_module=True):
    nvidia=next((item for item in devices if item['vendor']=='0x10de'),None)
    if not nvidia:raise ValueError('No physical NVIDIA display GPU was detected.')
    integrated=next((item for item in devices if item['vendor'] in ('0x8086','0x1002')),None)
    text='{ config, ... }: {\n  services.xserver.videoDrivers = [ "'+('amdgpu' if integrated and integrated['vendor']=='0x1002' else 'modesetting')+'" "nvidia" ];\n  hardware.graphics.enable = true;\n  hardware.nvidia = {\n    modesetting.enable = true;\n    nvidiaSettings = true;\n    open = '+('true' if open_module else 'false')+';\n    package = config.boot.kernelPackages.nvidiaPackages.stable;\n'
    if integrated:
        key='intelBusId' if integrated['vendor']=='0x8086' else 'amdgpuBusId'
        text+='    prime = {\n      offload.enable = true;\n      offload.enableOffloadCmd = true;\n      '+key+' = "'+pci_bus_id(integrated['address'])+'";\n      nvidiaBusId = "'+pci_bus_id(nvidia['address'])+'";\n    };\n'
    return text+'  };\n}\n'

def virtual_machine():
    p=subprocess.run(['systemd-detect-virt'],text=True,capture_output=True)
    return p.stdout.strip() in ('oracle','vmware','qemu','kvm','microsoft')

def amd_module(devices):
    if not any(item['vendor']=='0x1002' for item in devices):raise ValueError('No AMD Radeon display GPU was detected. A Ryzen CPU does not always include a GPU.')
    if any(item['vendor']=='0x10de' for item in devices):raise ValueError('AMD + NVIDIA graphics detected. Use drivers nvidia install for a hybrid profile instead of replacing NVIDIA with an AMD-only profile.')
    return '''{ ... }: {
  services.xserver.videoDrivers = [ "modesetting" "amdgpu" ];
  hardware.graphics = { enable = true; enable32Bit = true; };
  boot.initrd.kernelModules = [ "amdgpu" ];
}
'''


def install_driver(vendor,proprietary=False,dry_run=False):
    if virtual_machine():raise SystemExit('This VM sees a virtual GPU. Install BoralancesOS on the PC to configure its physical GPU; do not install the Windows host GPU driver in VirtualBox.')
    devices=graphics_devices()
    if vendor=='auto':vendor='nvidia' if any(item['vendor']=='0x10de' for item in devices) else 'amd' if any(item['vendor']=='0x1002' for item in devices) else 'intel'
    try:
        if vendor=='nvidia':check_nvidia_support(devices,proprietary)
        if vendor=='intel' and any(item['vendor']=='0x10de' for item in devices):raise ValueError('Use the NVIDIA hybrid profile to retain both GPUs.')
        text=nvidia_module(devices,not proprietary) if vendor=='nvidia' else amd_module(devices) if vendor=='amd' else '{ ... }: { hardware.graphics = { enable = true; enable32Bit = true; }; }\n'
    except ValueError as error:raise SystemExit(str(error))
    if dry_run:print(text);return 0
    if os.geteuid()!=0:raise SystemExit('Run: sudo boralancesos drivers '+vendor+' install')
    source=Path('/etc/nixos/boralances')
    if not (source/'hardware-configuration.local.nix').is_file():raise SystemExit('Use the installed BoralancesOS system. The live session cannot change your installed drivers.')
    if shutil.disk_usage('/').free<6*1024**3:raise SystemExit('Free at least 6 GiB before building a driver generation.')
    target=source/'drivers.local.nix';previous=target.read_bytes() if target.exists() else None
    if previous is not None and not target.with_suffix('.nix.backup').exists():target.with_suffix('.nix.backup').write_bytes(previous)
    target.write_text(text)
    p=subprocess.run(['nixos-rebuild','boot','--flake','path:'+str(source)+'#workstation'])
    if p.returncode:
        if previous is None:target.unlink(missing_ok=True)
        else:target.write_bytes(previous)
        return p.returncode
    print(vendor.upper()+' driver generation prepared. Save your work and reboot. The previous boot generation remains available.')
    if vendor=='nvidia':print('Hybrid GPUs use: nvidia-offload <application>. The open module requires Turing/GTX 16-series or newer; legacy GPUs need their supported driver branch.')
    elif vendor=='amd':print('AMD Radeon and Ryzen integrated Radeon graphics use amdgpu with Mesa/RADV. 32-bit graphics are enabled for supported Steam and Wine applications.')
    return 0

def install_nvidia(proprietary=False,dry_run=False):
    return install_driver('nvidia',proprietary,dry_run)


def check_nvidia_support(devices,proprietary=False):
    catalog=json.loads(Path(__file__).with_name('nvidia-open-gpus.json').read_text())
    detected=[item for item in devices if item['vendor']=='0x10de']
    if not detected:raise ValueError('No physical NVIDIA display GPU was detected.')
    for item in detected:
        device=item.get('device','').lower().removeprefix('0x')
        name=catalog['devices'].get(device)
        if not name:raise ValueError('NVIDIA PCI ID '+device+' is not in the bundled '+catalog['driverVersion']+' modern-GPU list. Keep the Mesa/Nouveau fallback or configure the driver branch for this GPU; a modern NVIDIA profile will not be applied blindly.')
        if proprietary and ('blackwell' in name.lower() or re.search(r'RTX\s*50\d\d',name,re.I)):raise ValueError('This Blackwell GPU requires the open kernel module. Omit --proprietary.')
    return catalog['driverVersion']


def prepare_installation_graphics(destination):
    if virtual_machine():print('VirtualBox graphics selected; physical GPU drivers are not applied.');return 0
    devices=graphics_devices();target=Path(destination)/'drivers.local.nix'
    if target.exists():raise ValueError('A driver profile already exists; it will not be overwritten.')
    if any(item['vendor']=='0x10de' for item in devices):
        try:check_nvidia_support(devices)
        except ValueError as error:print(str(error));return 0
        text=nvidia_module(devices);label='NVIDIA with detected hybrid PRIME routing'
    elif any(item['vendor']=='0x1002' for item in devices):text=amd_module(devices);label='AMD Radeon / Ryzen Radeon with Mesa RADV'
    else:print('Automatic Intel/Mesa graphics selected.');return 0
    target.write_text(text);print('Native graphics profile: '+label+'. Driver packages may require network access.');return 0


def gpu_status():
    print('BoralancesOS graphics\n')
    if virtual_machine():print('Virtual-machine GPU: the host NVIDIA/AMD GPU is not directly exposed.\n')
    result=subprocess.run(['lspci','-nnk'],text=True,capture_output=True)
    blocks=[]
    for block in re.split(r'(?=^[^\s])',result.stdout,flags=re.M):
        if any(label in block for label in ('VGA compatible controller','3D controller','Display controller')):blocks.append(block.strip())
    print('\n\n'.join(blocks) or 'No PCI display controller was reported.')
    print('\nAMD / Ryzen Radeon: Linux amdgpu + Mesa RADV, including 32-bit graphics.\nNVIDIA modern GPUs: sudo boralancesos drivers nvidia install\nAMD native setup: sudo boralancesos drivers amd install\nInspect a plan without changing it: boralancesos drivers auto install --dry-run\nVulkan diagnostics: boralancesos gpu test')
    if shutil.which('nvidia-smi'):subprocess.run(['nvidia-smi'])
    return result.returncode


def gpu_run(arguments):
    if arguments and arguments[0]=='--':arguments=arguments[1:]
    if not arguments:raise SystemExit('Usage: boralancesos gpu run <application> [arguments]')
    if virtual_machine():raise SystemExit('Use the native PC installation to choose a physical GPU.')
    if shutil.which('nvidia-offload'):command=['nvidia-offload',*arguments]
    else:command=['env','DRI_PRIME=1',*arguments]
    os.execvp(command[0],command)


def unreal(action,path=None,arguments=()):
    if action in ('guide','install'):
        print('Use Epic\'s native Linux build; an Epic account and license acceptance are required. There is no apt install unreal-engine command on BoralancesOS.\n1. Install BoralancesOS on the PC.\n2. AMD Radeon / Ryzen Radeon uses Mesa RADV. For supported RTX/GTX 16-series or newer: sudo boralancesos drivers nvidia install\n3. Reboot, then check: boralancesos gpu\n4. Download and extract Epic\'s Linux editor: '+UNREAL_URL+'\n5. Run: boralancesos unreal run /path/to/Engine/Binaries/Linux/UnrealEditor\nOfficial guide: '+GUIDE_URL+'\nVirtualBox does not expose the laptop NVIDIA GPU or its Vulkan driver. Epic recommends 32 GB RAM and at least 8 GB VRAM for a smooth editor experience.')
        if action=='install':subprocess.Popen(['xdg-open',UNREAL_URL],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        return 0
    if virtual_machine():raise SystemExit('Use the native PC installation for Unreal. VirtualBox\'s virtual GPU is not a replacement for native GPU Vulkan acceleration.')
    if not path or not Path(path).is_file():raise SystemExit('Provide the extracted Engine/Binaries/Linux/UnrealEditor executable.')
    if os.geteuid()==0:raise SystemExit('Run Unreal as your normal desktop user, without sudo.')
    command=['boralances-unreal-env',str(Path(path).resolve()),*arguments]
    if shutil.which('nvidia-offload'):command.insert(0,'nvidia-offload')
    os.execvp(command[0],command)


if __name__=='__main__':
    if len(sys.argv)!=3 or sys.argv[1]!='prepare-install':raise SystemExit('This helper accepts prepare-install <configuration-directory>.')
    try:raise SystemExit(prepare_installation_graphics(sys.argv[2]))
    except (OSError,ValueError) as error:raise SystemExit(str(error))
