"""Download and verify the official base profile before the library opens it.

Some minecraft-launcher-lib downloads silently return False on an HTTP error,
which otherwise surfaces as an unrelated missing .json file.
"""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
import requests

HOSTS = ('piston-meta.mojang.com', 'launchermeta.mojang.com')
MANIFEST_PATH = '/mc/game/version_manifest_v2.json'


def _response(url, get):
    response = get(url, timeout=(15, 45))
    response.raise_for_status()
    if len(response.content) > 8 * 1024 * 1024:
        raise ValueError('Official version metadata is unexpectedly large.')
    return response.content


def version_manifest(get=None):
    get = get or requests.get
    for host in HOSTS:
        try:
            data = json.loads(_response('https://' + host + MANIFEST_PATH, get))
            if not isinstance(data.get('versions'), list):
                raise ValueError('Invalid official version list.')
            return data
        except (requests.RequestException, ValueError, KeyError):
            pass
    raise ValueError('Could not download the official Minecraft version list. Check your connection or proxy, then retry Install / repair.')


def ensure_version(version, directory, get=None):
    get = get or requests.get
    if not re.fullmatch(r'[A-Za-z0-9._-]{1,100}', version) or version in ('.', '..'):
        raise ValueError('Invalid Minecraft version.')
    manifest = version_manifest(get)
    entry = next((v for v in manifest['versions'] if v.get('id') == version), None)
    if not entry:
        raise ValueError('Minecraft ' + version + ' is not in the official version list.')
    expected = entry.get('sha1', '')
    origin = urlsplit(entry.get('url', ''))
    if not re.fullmatch('[0-9a-f]{40}', expected) or origin.scheme != 'https' or origin.netloc not in HOSTS:
        raise ValueError('Invalid official version metadata reference.')
    target = Path(directory) / 'versions' / version / (version + '.json')
    if target.is_file() and hashlib.sha1(target.read_bytes()).hexdigest() == expected:
        return target
    for host in (origin.netloc,) + tuple(h for h in HOSTS if h != origin.netloc):
        try:
            data = _response(urlunsplit(('https', host, origin.path, '', '')), get)
            if hashlib.sha1(data).hexdigest() != expected or json.loads(data).get('id') != version:
                raise ValueError('Official Minecraft metadata checksum mismatch.')
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix('.json.boralances-download')
            temporary.write_bytes(data)
            temporary.replace(target)
            return target
        except (requests.RequestException, ValueError, KeyError):
            pass
    raise ValueError('Minecraft ' + version + ' version metadata could not be downloaded and verified from Mojang. Check your connection or proxy, then retry Install / repair. Your worlds and mods have been kept.')
