"""Initialize an explicitly selected, signature-free blank installation disk."""
import argparse,json,os,stat,subprocess,sys
from pathlib import Path

MINIMUM_DISK=32*1024**3

def eligible(device):
    return (device.get('type')=='disk' and int(device.get('size') or 0)>=MINIMUM_DISK
            and not device.get('ro') and not device.get('fstype') and not device.get('children')
            and not any(device.get('mountpoints') or []))

def list_blank_disks():
    result=subprocess.run(['lsblk','--json','--bytes','--paths','--output','NAME,TYPE,SIZE,FSTYPE,MOUNTPOINTS,RO,MODEL'],capture_output=True,text=True,check=True,timeout=8)
    return [item for item in json.loads(result.stdout)['blockdevices'] if eligible(item)]

def check_disk(name):
    path=Path(name).resolve()
    if not str(path).startswith('/dev/') or not stat.S_ISBLK(path.stat().st_mode):raise ValueError('Select a real blank block device.')
    matches=[device for device in list_blank_disks() if Path(device['name']).resolve()==path]
    if len(matches)!=1:raise ValueError('The selected disk is not blank, is read-only, is in use, or is smaller than 32 GiB.')
    for mount in ('/mnt','/mnt/boot'):
        if subprocess.run(['mountpoint','-q',mount]).returncode==0:raise ValueError('Unmount the prepared destination before initializing a different blank disk.')
    result=subprocess.run(['wipefs','--json',str(path)],capture_output=True,text=True,check=True,timeout=8)
    if json.loads(result.stdout).get('signatures'):raise ValueError('The disk contains existing signatures and will not be erased automatically.')
    return str(path)

def prepare_disk(name):
    if os.geteuid()!=0:raise ValueError('Disk preparation requires the live installer’s administrator process.')
    disk=check_disk(name)
    def run(*args):subprocess.run(list(args),check=True,timeout=120)
    run('parted','--script','--align','optimal',disk,'mklabel','gpt')
    run('parted','--script',disk,'mkpart','ESP','fat32','1MiB','1025MiB')
    run('parted','--script',disk,'set','1','esp','on')
    run('parted','--script',disk,'mkpart','primary','ext4','1025MiB','100%')
    run('partprobe',disk);run('udevadm','settle')
    suffix='p' if disk[-1].isdigit() else ''
    boot=disk+suffix+'1';root=disk+suffix+'2'
    if not all(Path(part).is_block_device() for part in (boot,root)):raise ValueError('New partitions did not appear. Review the disk in the disk utility.')
    run('mkfs.vfat','-F','32','-n','BORESP',boot)
    run('mkfs.ext4','-F','-L','BORALANCES',root)
    Path('/mnt').mkdir(exist_ok=True);run('mount',root,'/mnt')
    Path('/mnt/boot').mkdir(exist_ok=True);run('mount',boot,'/mnt/boot')
    print('Blank disk prepared: '+disk+' · EFI: '+boot+' · root: '+root)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('action',choices=('list','check','prepare'));parser.add_argument('disk',nargs='?');args=parser.parse_args()
    try:
        if args.action=='list':print(json.dumps(list_blank_disks()))
        elif not args.disk:raise ValueError('Choose a blank disk explicitly.')
        elif args.action=='check':print('Blank disk verified: '+check_disk(args.disk))
        else:prepare_disk(args.disk)
    except (OSError,ValueError,subprocess.SubprocessError) as error:raise SystemExit(str(error))
