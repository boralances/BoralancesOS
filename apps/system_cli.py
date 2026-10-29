"""BoralancesOS system information and explicit, rootless setup commands."""
import argparse
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys

VERSION='1.0.0'
KALI='boralances-kali'
IMAGE='docker.io/kalilinux/kali-rolling:latest'
TOOLS=('nmap','tcpdump','tshark','sqlmap','nikto','whois','dnsutils','netcat-openbsd','curl','jq','python3','python3-venv','git')


def execute(args,check=True): return subprocess.run(args,check=check)


def information():
    logo=['██████╗ ','██╔══██╗','██████╔╝','██╔══██╗','██████╔╝','╚═════╝ ']
    try: mem={line.split(':')[0]:int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines()}; memory=f"{(mem['MemTotal']-mem['MemAvailable'])/1024:.0f} / {mem['MemTotal']/1024:.0f} MiB"
    except (OSError,ValueError,KeyError): memory='Unavailable'
    details=[f'BoralancesOS {VERSION}',f'{os.environ.get("USER","user")}@{platform.node()}',f'Kernel  {platform.release()}',f'Desktop Wayland / Hyprland',f'Memory  {memory}',f'CPU     {os.cpu_count()} logical processors']
    color=sys.stdout.isatty()
    for symbol,line in zip(logo,details): print(('\033[96m' if color else '')+symbol+('  \033[0m' if color else '  ')+line)
    print('\nTry: boralancesos doctor | apps | settings | widgets | tor browser | kali --help')


def kali(action,args,dry_run=False):
    if action=='install':
        if dry_run:
            print('Rootless image:',IMAGE); print('Tools:',', '.join(TOOLS)); print('No host mounts or privileged mode.'); return 0
        if os.geteuid()==0: raise SystemExit('Run this command as your normal desktop user, without sudo.')
        if shutil.disk_usage(Path.home()).free<3*1024**3: raise SystemExit('At least 3 GiB of guest storage is needed for Kali tools.')
        exists=subprocess.run(['podman','container','exists',KALI]).returncode==0
        if not exists:
            execute(['podman','pull',IMAGE])
            execute(['podman','run','-d','--name',KALI,'--security-opt=no-new-privileges',IMAGE,'sleep','infinity'])
        else: execute(['podman','start',KALI])
        script='apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends '+' '.join(TOOLS)+' && apt-get clean'
        execute(['podman','exec',KALI,'sh','-c',script])
        print('Kali tools ready. Open with: boralancesos kali shell')
    elif action=='status': return execute(['podman','ps','-a','--filter','name=^'+KALI+'$'],check=False).returncode
    else:
        if subprocess.run(['podman','container','exists',KALI]).returncode: raise SystemExit('Run boralancesos kali install first.')
        execute(['podman','start',KALI])
        command=['bash'] if action=='shell' else args
        if not command: raise SystemExit('Usage: boralancesos kali exec <tool> [arguments]')
        os.execvp('podman',['podman','exec',*(['-it'] if sys.stdin.isatty() else []),KALI,*command])
    return 0


def main():
    parser=argparse.ArgumentParser(prog='boralancesos',description='BoralancesOS information, desktop controls and optional tool environments.')
    parser.add_argument('--version',action='version',version='BoralancesOS '+VERSION)
    subs=parser.add_subparsers(dest='command')
    for name in ('info','version','doctor','status','apps','settings','widgets','taskmanager','shortcuts','storage','uptime','network','display','logs','lock','screenshot','restart-shell','help'): subs.add_parser(name)
    profile=subs.add_parser('profile'); profile.add_argument('value',choices=('fluid','performance','balanced','glass','reduced-motion'))
    theme=subs.add_parser('theme'); theme.add_argument('value',choices=('dark','light','system'))
    center=subs.add_parser('center'); center.add_argument('section',choices=('network','bluetooth','sound','display','power','media'))
    widget=subs.add_parser('widget'); widget.add_argument('name'); widget.add_argument('action',choices=('on','off'))
    steam=subs.add_parser('steam'); steam.add_argument('action',choices=('install','open','status'),nargs='?',default='status')
    tor=subs.add_parser('tor'); tor.add_argument('action',choices=('start','stop','status','browser'),nargs='?',default='status')
    tools=subs.add_parser('kali',description='Rootless Kali tools container. No host folders are mounted.')
    tools.add_argument('action',choices=('install','shell','exec','status'),nargs='?',default='status')
    tools.add_argument('--dry-run',action='store_true'); tools.add_argument('arguments',nargs=argparse.REMAINDER)
    for name in ('bluetooth','disks','desktop','rebuild'):subs.add_parser(name)
    for name in ('devices','usb','audio','wifi'):
        device=subs.add_parser(name);device.add_argument('action',choices=('status','gui'),nargs='?',default='status')
    nvidia=subs.add_parser('nvidia');nvidia.add_argument('action',choices=('center','settings','status'),nargs='?',default='center')
    gpu=subs.add_parser('gpu');gpu.add_argument('action',choices=('status','test','run','center','monitor'),nargs='?',default='status');gpu.add_argument('arguments',nargs=argparse.REMAINDER)
    for name in ('install','remove','search'):
        package=subs.add_parser(name);package.add_argument('package')
    unreal_parser=subs.add_parser('unreal');unreal_parser.add_argument('action',choices=('guide','install','run'),nargs='?',default='guide');unreal_parser.add_argument('path',nargs='?');unreal_parser.add_argument('arguments',nargs=argparse.REMAINDER)
    drivers=subs.add_parser('drivers');drivers.add_argument('vendor',choices=('status','auto','nvidia','amd','intel'),nargs='?',default='status');drivers.add_argument('action',choices=('status','install'),nargs='?',default='status');drivers.add_argument('--dry-run',action='store_true');drivers.add_argument('--proprietary',action='store_true',help='Use proprietary NVIDIA kernel modules only when supported by your GPU/driver branch.')
    arg=parser.parse_args()
    if arg.command=='kali' and arg.action=='install' and arg.arguments==['--dry-run']:
        arg.dry_run=True; arg.arguments=[]
    if arg.command in (None,'info'): information()
    elif arg.command=='version': print('BoralancesOS '+VERSION)
    elif arg.command=='help': parser.print_help()
    elif arg.command=='unreal':
        from hardware_tools import unreal
        return unreal(arg.action,arg.path,arg.arguments)
    elif arg.command=='drivers':
        from hardware_tools import gpu_status,install_driver
        if arg.vendor!='status' and arg.action=='install':return install_driver(arg.vendor,arg.proprietary,arg.dry_run)
        return gpu_status()
    elif arg.command=='gpu':
        from hardware_tools import gpu_status,gpu_run
        if arg.action in ('center','monitor'):
            command='boralances-gpu-center' if arg.action=='center' else 'boralances-gpu-monitor';os.execvp(command,[command])
        if arg.action=='run':return gpu_run(arg.arguments)
        if arg.action=='test':return execute(['vulkaninfo','--summary'],check=False).returncode
        return gpu_status()
    elif arg.command=='nvidia':
        if arg.action=='status':
            from hardware_tools import gpu_status
            return gpu_status()
        command='nvidia-settings' if arg.action=='settings' else 'boralances-nvidia-center'
        if not shutil.which(command):raise SystemExit('NVIDIA Settings is available with the native NVIDIA driver profile. Use boralancesos nvidia for the hardware center.')
        os.execvp(command,[command])
    elif arg.command in ('devices','usb','audio','wifi') and arg.action=='gui':
        commands={'devices':['boralances-devices'],'usb':['boralances-devices'],'audio':['boralances-audio-center'],'wifi':['boralances-center','--section','network']}
        command=commands[arg.command];os.execvp(command[0],command)
    elif arg.command=='usb':return execute(['lsusb','-t'],check=False).returncode
    elif arg.command in ('install','remove','search'):
        if not re.fullmatch(r'[A-Za-z0-9_+.-]+',arg.package):raise SystemExit('Use a package name, without flags or shell syntax.')
        if arg.command=='install':command=['nix','profile','add','nixpkgs#'+arg.package]
        elif arg.command=='remove':command=['nix','profile','remove',arg.package]
        else:command=['nix','search','nixpkgs',arg.package]
        return execute(command,check=False).returncode
    elif arg.command=='rebuild':
        if os.geteuid()!=0:raise SystemExit('Run: sudo boralancesos rebuild')
        return execute(['nixos-rebuild','switch','--flake','path:/etc/nixos/boralances#workstation'],check=False).returncode
    elif arg.command in ('devices','audio','wifi','bluetooth','disks','desktop'):
        commands={'gpu':['lspci','-nnk'],'devices':['lsusb'],'audio':['wpctl','status'],'wifi':['nmcli','device','wifi','list'],'bluetooth':['bluetoothctl','show'],'disks':['lsblk','-o','NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS,MODEL'],'desktop':['thunar',str(Path.home()/'Desktop')]}
        result=execute(commands[arg.command],check=False).returncode
        if arg.command=='gpu' and shutil.which('nvidia-smi'):execute(['nvidia-smi'],check=False)
        return result
    elif arg.command in ('profile','theme'):
        return execute(['boralances-control',arg.command,arg.value],check=False).returncode
    elif arg.command=='center': return execute(['boralances-control','center',arg.section],check=False).returncode
    elif arg.command=='widget':
        # The desktop controller validates the name against its preference schema.
        return execute(['boralances-control','set','widget-'+arg.name,'true' if arg.action=='on' else 'false'],check=False).returncode
    elif arg.command in ('status','storage','uptime','network','display','logs','lock','screenshot','restart-shell'):
        commands={'status':['systemctl','--user','--failed','--no-pager'],
            'storage':['df','-h','/'], 'uptime':['uptime'],
            'network':['nmcli','device','status'], 'display':['hyprctl','-j','monitors'],
            'logs':['journalctl','--user','-b','-p','warning','-n','60','--no-pager'],
            'lock':['hyprlock'], 'screenshot':['boralances-control','screenshot'],
            'restart-shell':['boralances-control','shell-restart']}
        return execute(commands[arg.command],check=False).returncode
    elif arg.command=='kali': return kali(arg.action,arg.arguments,arg.dry_run)
    elif arg.command=='tor':
        if arg.action=='browser': os.execvp('boralances-browser',['boralances-browser','--tor'])
        return execute(['systemctl','--user',arg.action,'boralances-tor.service'],check=False).returncode
    elif arg.command=='steam':
        found=shutil.which('steam')
        if arg.action=='open' and found: os.execv(found,[found])
        print('Steam is installed and ready.' if found else 'Steam is missing from this system configuration. Rebuild the VM with gaming enabled.')
        return 0 if found else 1
    elif arg.command=='apps':
        for title,binary in [('Browser','boralances-browser'),('Steam','steam'),('Task Manager','boralances-task-manager'),('Files','thunar'),('Editor','mousepad'),('PDF viewer','evince'),('Video player','mpv'),('Image viewer','imv'),('Calculator','qalculate-gtk'),('Launcher','boralances-launcher')]:
            print(f'{title:18} {"Installed" if shutil.which(binary) else "Not installed"}')
    elif arg.command=='doctor':
        print('System services:'); execute(['systemctl','--failed','--no-pager'],check=False)
        print('\nDesktop services:'); execute(['systemctl','--user','--failed','--no-pager'],check=False)
        print('\nStorage:'); execute(['df','-h','/'],check=False)
    else:
        commands={'settings':['boralances-control-center'],'widgets':['boralances-control-center','--page','widgets'],'taskmanager':['boralances-task-manager'],'shortcuts':['boralances-shortcuts']}
        os.execvp(commands[arg.command][0],commands[arg.command])
    return 0


if __name__=='__main__': raise SystemExit(main())
