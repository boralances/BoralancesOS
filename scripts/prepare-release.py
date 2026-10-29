"""Prepare verified GitHub Release assets; never upload or flash a device."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil

ROOT=Path(__file__).resolve().parents[1]
BASE='https://github.com/boralances/BoralancesOS/releases/download/boralancesos-v1/'

def digest(path):
    value=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):value.update(chunk)
    return value.hexdigest()

def prepare(iso,kit,output,chunk_size=23_000_000):
    iso,kit,output=Path(iso),Path(kit),Path(output)
    if not 1<=chunk_size<25_000_000:raise ValueError('Release parts must stay below 25 MB.')
    for path in (iso,kit):
        if not path.is_file() or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*',path.name):raise ValueError('Invalid artifact file.')
    if kit.stat().st_size>=25_000_000:raise ValueError('The VirtualBox kit exceeds 25 MB.')
    image_bytes=iso.stat().st_size
    count=(image_bytes+chunk_size-1)//chunk_size
    if not 1<=count<=1000:raise ValueError('Invalid ISO part count.')
    output.mkdir(parents=True,exist_ok=True)
    missing_bytes=0
    for index in range(count):
        target=output/f'{iso.name}.part{index+1:04d}'
        if not target.exists():missing_bytes+=min(chunk_size,image_bytes-index*chunk_size)
    if not (output/kit.name).exists():missing_bytes+=kit.stat().st_size
    if shutil.disk_usage(output).free<missing_bytes+1_000_000_000:
        raise OSError('Not enough free space to prepare remaining release parts while keeping 1 GB free.')
    parts=[];whole=hashlib.sha256();total=0
    with iso.open('rb') as source:
        while data:=source.read(chunk_size):
            name=f'{iso.name}.part{len(parts)+1:04d}';checksum=hashlib.sha256(data).hexdigest();target=output/name
            if target.exists():
                if target.stat().st_size!=len(data) or digest(target)!=checksum:raise FileExistsError(f'A different release part exists: {target}')
            else:
                temporary=target.with_name(name+'.partial')
                with temporary.open('xb') as stream:stream.write(data)
                temporary.rename(target)
            parts.append({'name':name,'bytes':len(data),'sha256':checksum,'url':BASE+name});whole.update(data);total+=len(data)
    if not parts or len(parts)>1000:raise ValueError('Invalid ISO part count.')
    kit_hash=digest(kit);kit_target=output/kit.name
    if kit_target.exists():
        if digest(kit_target)!=kit_hash:raise FileExistsError(f'A different kit exists: {kit_target}')
    else:shutil.copyfile(kit,kit_target)
    manifest={'version':'1.0.0','releaseTag':'boralancesos-v1','published':False,'artifacts':[
        {'id':'iso','ready':True,'file':iso.name,'bytes':total,'sha256':whole.hexdigest(),'parts':parts},
        {'id':'virtualbox','ready':True,'file':kit.name,'bytes':kit.stat().st_size,'sha256':kit_hash,'url':'downloads/'+kit.name,
         'parts':[{'name':kit.name,'bytes':kit.stat().st_size,'sha256':kit_hash,'url':BASE+kit.name}]}]}
    (output/'boralancesos-v1.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    checks=[f'{whole.hexdigest()}  {iso.name}']+[f'{p["sha256"]}  {p["name"]}' for p in parts]+[f'{kit_hash}  {kit.name}']
    (output/'SHA256SUMS').write_text('\n'.join(checks)+'\n',encoding='utf-8')
    for name in ('Get-BoralancesOS.ps1','get-boralancesos.py'):shutil.copyfile(ROOT/'design/os-site/downloads'/name,output/name)
    return manifest

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--iso',type=Path,required=True);parser.add_argument('--kit',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=ROOT/'out/V1/Release')
    args=parser.parse_args();manifest=prepare(args.iso,args.kit,args.output)
    print(f'Prepared {len(manifest["artifacts"][0]["parts"])} ISO parts below 25 MB in {args.output}. Nothing uploaded.')

if __name__=='__main__':main()
