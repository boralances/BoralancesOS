#!/usr/bin/env python3
"""Download verified release parts into one resumable ISO; never writes a disk."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import urllib.parse
import urllib.request

DEFAULT_MANIFEST='https://github.com/boralances/web1/releases/download/boralancesos-v1/boralancesos-v1.json'
MAX_PART=25_000_000

def filename(value):
    if not isinstance(value,str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*',value):raise ValueError('Unsafe release filename')
    return value

def checksum(value):
    if not isinstance(value,str) or not re.fullmatch(r'[0-9a-fA-F]{64}',value):raise ValueError('Invalid SHA-256 checksum')
    return value.lower()

def remote(url):
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme!='https' and not (parsed.scheme=='http' and parsed.hostname in ('localhost','127.0.0.1','::1')):raise ValueError('Downloads require HTTPS')
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BoralancesOS-V1-Downloader'}),timeout=90)

def load_manifest(location):
    parsed=urllib.parse.urlparse(location)
    if parsed.scheme in ('http','https'):
        with remote(location) as stream:data=stream.read(2_000_001)
        base=None
    else:
        path=Path(location).resolve();data=path.read_bytes();base=path.parent
    if len(data)>2_000_000:raise ValueError('Release manifest is too large')
    return json.loads(data),base

def validate_artifact(artifact):
    filename(artifact['file']);checksum(artifact['sha256'])
    parts=artifact['parts']
    if not isinstance(parts,list) or not 1<=len(parts)<=1000:raise ValueError('Invalid release part count')
    seen=set()
    for part in parts:
        name=filename(part['name']);checksum(part['sha256'])
        if name in seen or not isinstance(part['bytes'],int) or not 0<part['bytes']<MAX_PART:raise ValueError('Invalid or duplicate release part')
        seen.add(name)
    if sum(part['bytes'] for part in parts)!=artifact['bytes']:raise ValueError('Part sizes do not match the complete file')

def digest_file(path):
    digest=hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda:stream.read(4*1024*1024),b''):digest.update(data)
    return digest.hexdigest()

def assemble(manifest,base,artifact_id,output):
    artifact=next((item for item in manifest['artifacts'] if item['id']==artifact_id),None)
    if not artifact or not artifact.get('ready'):raise ValueError('The requested artifact is not ready')
    validate_artifact(artifact);output=Path(output).resolve();output.mkdir(parents=True,exist_ok=True)
    target=output/artifact['file'];expected=checksum(artifact['sha256'])
    if target.exists():
        if digest_file(target)==expected:print('Already verified:',target);return target
        raise ValueError('A different file already exists at '+str(target)+'; move it before retrying')
    partial=target.with_name(target.name+'.partial');marker=target.with_name(target.name+'.partial.json')
    if partial.exists() and not marker.exists():raise ValueError('An unrecognized partial file exists; it will not be overwritten')
    if marker.exists():
        if json.loads(marker.read_text()).get('sha256')!=expected:raise ValueError('The partial download belongs to another release')
    else:marker.write_text(json.dumps({'file':artifact['file'],'sha256':expected})+'\n')
    complete=0;digest=hashlib.sha256()
    if partial.exists():
        with partial.open('rb') as stream:
            for part in artifact['parts']:
                data=stream.read(part['bytes'])
                if not data:break
                if len(data)!=part['bytes'] or hashlib.sha256(data).hexdigest()!=checksum(part['sha256']):raise ValueError('The existing partial file is damaged; move it and its marker before retrying')
                digest.update(data);complete+=1
            if stream.read(1):raise ValueError('The existing partial file is larger than this release')
    remaining=sum(part['bytes'] for part in artifact['parts'][complete:])
    if shutil.disk_usage(output).free<remaining+MAX_PART:raise ValueError('Not enough free space for the assembled file')
    with partial.open('ab') as destination:
        for index,part in enumerate(artifact['parts'][complete:],complete+1):
            print(f'Downloading {index}/{len(artifact["parts"])}: {part["name"]}',flush=True)
            local=base/part['name'] if base else None
            if local and local.is_file():
                with local.open('rb') as stream:data=stream.read(part['bytes']+1)
            else:
                if not manifest.get('published'):raise ValueError('Remote release assets are not published yet')
                with remote(part['url']) as stream:data=stream.read(part['bytes']+1)
            if len(data)!=part['bytes'] or hashlib.sha256(data).hexdigest()!=checksum(part['sha256']):raise ValueError('Checksum or size mismatch for '+part['name'])
            destination.write(data);destination.flush();os.fsync(destination.fileno());digest.update(data)
    if digest.hexdigest()!=expected:raise ValueError('The final file checksum did not match; the partial file has been retained')
    partial.replace(target);marker.unlink();print('SHA-256 verified:',expected);print('Ready:',target)
    return target

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    local=Path(__file__).with_name('boralancesos-v1.json')
    parser.add_argument('--manifest',default=str(local) if local.exists() else DEFAULT_MANIFEST)
    parser.add_argument('--artifact',choices=('iso','virtualbox'),default='iso')
    parser.add_argument('--output',default='.')
    args=parser.parse_args();manifest,base=load_manifest(args.manifest);assemble(manifest,base,args.artifact,args.output)

if __name__=='__main__':
    try:main()
    except (OSError,ValueError,KeyError,StopIteration) as error:print('Download stopped:',error,file=sys.stderr);raise SystemExit(1)
