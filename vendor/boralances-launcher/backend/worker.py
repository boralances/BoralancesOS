"""One-shot JSON RPC worker. Credentials arrive on stdin, never argv."""
import contextlib
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
# JSON RPC is always UTF-8, independently of the Windows display language.
sys.stdin.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')
# The embedded Python runtime isolates sys.path; import our own unpacked module
# from the backend directory explicitly in both source and packaged builds.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import minecraft_launcher_lib as mc
from microsoft_auth import AuthFailure, complete as complete_microsoft_auth, STAGES as AUTH_STAGES
from game_metadata import ensure_version, version_manifest

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
_session_init = requests.sessions.Session.__init__
_session_request = requests.sessions.Session.request

def _reliable_session(self, *args, **kwargs):
    _session_init(self, *args, **kwargs)
    adapter = HTTPAdapter(max_retries=Retry(total=4, connect=4, read=4, status=3, backoff_factor=0.8, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=['GET', 'HEAD']))
    self.mount('https://', adapter)

def _timed_request(self, *args, **kwargs):
    kwargs.setdefault('timeout', (15, 90))
    return _session_request(self, *args, **kwargs)

requests.sessions.Session.__init__ = _reliable_session
requests.sessions.Session.request = _timed_request

import os
OUT = os.fdopen(os.dup(sys.stdout.fileno()), 'w', buffering=1, encoding='utf-8')
os.dup2(sys.stderr.fileno(), sys.stdout.fileno())

def emit(value):
    OUT.write(json.dumps(value, default=str) + '\n')
    OUT.flush()

def progress(status=None, current=None, total=None):
    emit({'event': 'progress', 'status': status, 'current': current, 'total': total})

CALLBACK = {
    'setStatus': lambda value: progress(status=value),
    'setProgress': lambda value: progress(current=value),
    'setMax': lambda value: progress(total=value),
}

def java_for(version, directory, custom=''):
    if custom:
        if not Path(custom).is_file():
            raise ValueError('The selected Java executable does not exist.')
        return custom
    metadata = json.loads((Path(directory) / 'versions' / version / (version + '.json')).read_text())
    if sys.platform == 'linux':
        major = metadata.get('javaVersion', {}).get('majorVersion', 8)
        native = os.environ.get('BORALANCES_JAVA_' + str(major))
        if native and Path(native).is_file():
            return native
    component = metadata.get('javaVersion', {}).get('component', 'jre-legacy')
    java = mc.runtime.get_executable_path(component, directory)
    if not java:
        mc.runtime.install_jvm_runtime(component, directory, callback=CALLBACK)
        java = mc.runtime.get_executable_path(component, directory)
    if not java:
        raise RuntimeError('No compatible Java runtime found. Choose a Java executable in Settings.')
    return java


def neo_catalog(minecraft):
    import requests
    import xml.etree.ElementTree as ET
    response = requests.get('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge', timeout=30)
    response.raise_for_status()
    versions = []
    for version in reversed(response.json()['versions']):
        parts = version.split('.')
        if not parts[0].isdigit() or len(parts) < 3 or not parts[1].isdigit():
            continue
        if int(parts[0]) >= 26:
            if len(parts) < 4 or not parts[2].isdigit():
                continue
            game = '.'.join(parts[:3]).removesuffix('.0')
        else:
            game = ('1.' + '.'.join(parts[:2])).removesuffix('.0')
        if game == minecraft:
            versions.append(version)
    if minecraft == '1.20.1':
        response = requests.get('https://maven.neoforged.net/releases/net/neoforged/forge/maven-metadata.xml', timeout=30)
        response.raise_for_status()
        versions += [v.text.split('-', 1)[1] for v in reversed(ET.fromstring(response.content).findall('./versioning/versions/version')) if v.text.startswith('1.20.1-')]
    return versions

def install_neo(minecraft, version, directory, java):
    import hashlib
    import requests
    import subprocess
    import tempfile
    import zipfile
    legacy = minecraft == '1.20.1'
    artifact = 'forge' if legacy else 'neoforge'
    coordinate = minecraft + '-' + version if legacy else version
    url = 'https://maven.neoforged.net/releases/net/neoforged/' + artifact + '/' + coordinate + '/' + artifact + '-' + coordinate + '-installer.jar'
    digest_response = requests.get(url + '.sha1', timeout=30)
    digest_response.raise_for_status()
    expected = digest_response.text.strip().split()[0].lower()
    if len(expected) != 40:
        raise ValueError('Invalid loader installer checksum.')
    with tempfile.TemporaryDirectory(dir=directory, prefix='.neo-installer-') as temporary:
        installer = Path(temporary) / 'installer.jar'
        response = requests.get(url, timeout=(30, 120), stream=True)
        response.raise_for_status()
        digest = hashlib.sha1()
        count = 0
        with installer.open('wb') as output:
            for chunk in response.iter_content(65536):
                count += len(chunk)
                if count > 512 * 1024 * 1024:
                    raise ValueError('Loader installer exceeds the size limit.')
                digest.update(chunk)
                output.write(chunk)
                progress(status='Downloading NeoForge installer', current=count, total=int(response.headers.get('Content-Length', 0)))
        if digest.hexdigest() != expected:
            raise ValueError('Loader installer checksum mismatch.')
        with zipfile.ZipFile(installer) as archive:
            metadata = json.loads(archive.read('version.json'))
        installed = metadata['id']
        if not installed or '/' in installed or '\\' in installed or ':' in installed or installed in ('.', '..'):
            raise ValueError('Unsafe loader version ID.')
        mc.vanilla_launcher.create_empty_vanilla_launcher_profiles_file(directory) if not mc.vanilla_launcher.do_vanilla_launcher_profiles_exists(directory) else None
        progress(status='Running NeoForge installer')
        command = [java, '-jar', str(installer), '--installClient' if legacy else '--install-client', directory]
        completed = subprocess.run(command, cwd=temporary, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
        (Path(directory) / 'loader-install.log').write_bytes(completed.stdout[-200000:])
        if completed.returncode:
            raise ValueError('NeoForge installer failed. Open the instance folder and inspect loader-install.log.')
    mc.install.install_minecraft_version(installed, directory, callback=CALLBACK)
    return installed


def audit_install(version, directory, java, base_version):
    import os
    probe = mc.command.get_minecraft_command(version, directory, {
        'username': 'InstallCheck', 'uuid': '00000000000000000000000000000000',
        'token': '0', 'executablePath': java, 'gameDirectory': directory,
    })
    for index, argument in enumerate(probe):
        value = None
        if argument in ('-cp', '-classpath', '--class-path', '--module-path') and index + 1 < len(probe):
            value = probe[index + 1]
        elif argument.startswith('-DlegacyClassPath='):
            value = argument.split('=', 1)[1]
        if value:
            for filename in value.split(os.pathsep):
                if filename and not filename.endswith('*') and not Path(filename).is_file():
                    raise ValueError('A required game library is missing: ' + Path(filename).name + '. Retry Install / repair.')
    metadata = json.loads((Path(directory) / 'versions' / base_version / (base_version + '.json')).read_text())
    asset = metadata.get('assetIndex')
    if asset:
        index_path = Path(directory) / 'assets' / 'indexes' / (asset['id'] + '.json')
        if not index_path.is_file():
            raise ValueError('The game asset index is missing. Retry Install / repair.')
        index = json.loads(index_path.read_text())
        for value in index['objects'].values():
            filename = Path(directory) / 'assets' / 'objects' / value['hash'][:2] / value['hash']
            if not filename.is_file() or filename.stat().st_size != value['size']:
                raise ValueError('A game asset is incomplete. Retry Install / repair.')
    if not Path(java).is_file():
        raise ValueError('Java runtime is incomplete. Retry Install / repair.')


def install_fabric(minecraft, loader_version, directory):
    from urllib.parse import quote
    response = requests.get('https://meta.fabricmc.net/v2/versions/loader/' + quote(minecraft, safe='') + '/' + quote(loader_version, safe='') + '/profile/json', timeout=30)
    response.raise_for_status()
    metadata = response.json()
    installed = metadata['id']
    if not installed or '/' in installed or '\\' in installed or ':' in installed or installed in ('.', '..'):
        raise ValueError('Unsafe Fabric profile ID.')
    version_dir = Path(directory) / 'versions' / installed
    version_dir.mkdir(parents=True, exist_ok=True)
    (version_dir / (installed + '.json')).write_text(json.dumps(metadata), encoding='utf-8')
    mc.install.install_minecraft_version(installed, directory, callback=CALLBACK)
    return installed

def dispatch(method, p):
    if method == 'versions':
        return version_manifest()['versions']
    if method == 'loaders':
        if p['loader'] == 'vanilla':
            return []
        if p['loader'] == 'neoforge':
            return neo_catalog(p['minecraft'])
        loader = mc.mod_loader.get_mod_loader(p['loader'])
        if not loader.is_minecraft_version_supported(p['minecraft']):
            return []
        return loader.get_loader_versions(p['minecraft'], False)
    if method == 'install':
        directory = p['directory']
        version = p['minecraft']
        progress(status='Verifying official Minecraft version metadata')
        ensure_version(version, directory)
        mc.install.install_minecraft_version(version, directory, callback=CALLBACK)
        java = java_for(version, directory, p.get('java', ''))
        if p['loader'] == 'neoforge':
            if p['loaderVersion'] not in neo_catalog(version):
                raise ValueError('This NeoForge build does not support the selected Minecraft version.')
            version = install_neo(version, p['loaderVersion'], directory, java)
        elif p['loader'] == 'fabric':
            loader = mc.mod_loader.get_mod_loader('fabric')
            if p['loaderVersion'] not in loader.get_loader_versions(version, False):
                raise ValueError('The selected Fabric build is unavailable.')
            version = install_fabric(version, p['loaderVersion'], directory)
        elif p['loader'] != 'vanilla':
            loader = mc.mod_loader.get_mod_loader(p['loader'])
            if p['loaderVersion'] not in loader.get_loader_versions(version, False):
                raise ValueError('This loader build is not available for the selected Minecraft version.')
            version = loader.install(version, directory, loader_version=p['loaderVersion'], callback=CALLBACK, java=java)
        audit_install(version, directory, java, p['minecraft'])
        return {'installedVersion': version, 'java': java, 'javaMajor': next((int(key.rsplit('_', 1)[1]) for key, value in os.environ.items() if key.startswith('BORALANCES_JAVA_') and value == java), None)}
    if method == 'command':
        a = p['account']
        options = {
            'username': a['name'], 'uuid': a['id'],
            'token': '0' if p.get('offline') else a['access_token'],
            'gameDirectory': p['directory'], 'executablePath': p['java'],
            'jvmArguments': ['-Xms512M', '-Xmx' + str(p['memory']) + 'M'],
            'customResolution': True,
            'resolutionWidth': str(p['width']), 'resolutionHeight': str(p['height']),
            'launcherName': 'Boralances', 'launcherVersion': '1.8.3',
            'disableMultiplayer': False, 'disableChat': False,
        }
        if p.get('offline'):
            options['jvmArguments'].append('-Dboralances.offlineProfile=true')
        command = mc.command.get_minecraft_command(p['installedVersion'], p['directory'], options)
        if p.get('offline'):
            # Imported profiles can carry this flag even with local server support.
            command = [argument for argument in command if argument != '--disableMultiplayer']
        # The library hardcodes msa, so set the standard account type explicitly.
        for index, argument in enumerate(command):
            if argument == '--userType' and index + 1 < len(command):
                command[index + 1] = 'legacy' if p.get('offline') else 'msa'
        return command
    if method == 'authStart':
        url, state, verifier = mc.microsoft_account.get_secure_login_data(p['clientId'], p['redirectUri'])
        return {'url': url, 'state': state, 'verifier': verifier}
    if method == 'authComplete':
        return complete_microsoft_auth(mc.microsoft_account, p, progress=lambda stage: progress(status='Microsoft sign-in · ' + AUTH_STAGES[stage]))
    if method == 'refresh':
        return complete_microsoft_auth(mc.microsoft_account, p, refreshing=True, progress=lambda stage: progress(status='Microsoft sign-in · ' + AUTH_STAGES[stage]))
    raise ValueError('Unknown worker method')

if __name__ == '__main__':
    try:
        request = json.loads(sys.stdin.readline())
        with contextlib.redirect_stdout(sys.stderr):
            result = dispatch(request['method'], request.get('params', {}))
        emit({'result': result})
    except Exception as error:
        if isinstance(error, AuthFailure):
            emit({'error': str(error), 'diagnostic': error.diagnostic})
            sys.exit(1)
        safe_messages = {
            'AccountNotOwnMinecraft': 'This account does not own Minecraft Java Edition.',
            'AzureAppNotPermitted': 'This Microsoft app needs approval to access Minecraft APIs.',
            'InvalidRefreshToken': 'Your session expired. Sign in again.',
            'UnsupportedVersion': 'This Minecraft version is not supported by the selected loader.',
        }
        if isinstance(error, requests.exceptions.RequestException):
            from urllib.parse import urlparse
            host = urlparse(getattr(getattr(error, 'request', None), 'url', '') or '').hostname or 'the game provider'
            safe_messages[type(error).__name__] = 'Network request failed for ' + host + '. Check connectivity and retry.'
        message = safe_messages.get(type(error).__name__, str(error) if isinstance(error, (ValueError, FileNotFoundError)) else 'Operation failed (' + type(error).__name__ + '). Check connectivity and Java settings, then retry.')
        emit({'error': message})
        sys.exit(1)
