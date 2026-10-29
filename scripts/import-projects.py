"""Import a distributable source subset. Never import a user's data directory."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
TEXT = {'.cjs', '.js', '.json', '.css', '.html', '.py', '.md', '.txt', '.svg'}
ALLOWED = TEXT | {'.png', '.jpg', '.jpeg', '.webp', '.ico', '.jar', '.mrpack', '.zip', '.ttf', '.woff2', '.ogg'}
DENIED_PARTS = {'data', 'profile', '.release-keys', '.cache', '__pycache__', 'node_modules', '.git'}


def replace_once(text, old, new, name):
    if text.count(old) != 1:
        raise ValueError(f'{name}: upstream changed; expected exactly one patch location')
    return text.replace(old, new, 1)


def patch_launcher(rel, text):
    name = rel.as_posix()
    if name == 'src/main.cjs':
        text = replace_once(text, "function encrypt(value) {assert(safeStorage.isEncryptionAvailable(),",
            "function encrypt(value) {assert(safeStorage.isEncryptionAvailable() && (process.platform==='win32' || safeStorage.getSelectedStorageBackend()!=='basic_text'),", name)
        text = replace_once(text, 'async function pythonPath(){',
            "async function pythonPath(){\n  if(process.platform==='linux' && process.env.BORALANCES_PYTHON)return process.env.BORALANCES_PYTHON;", name)
        text = replace_once(text, 'await updater.init();',
            "await updater.init();\n  if(process.platform==='linux')updater.set({autoCheck:false,supported:false,notes:'Updates are provided by BoralancesOS.'});", name)
        text = replace_once(text, "const ownerTools=require('./owner.cjs'),resolveOwner=()=>ownerTools.loadOwnerNearby(data,credentialScript(),require('./data-path.cjs').ownerCandidates(base,app.getPath('desktop')));",
            "const ownerTools=require('./owner.cjs'),resolveOwner=()=>process.platform==='linux'?Promise.resolve({ownerPC:false,uid:null,email:null,bootstrap:null}):ownerTools.loadOwnerNearby(data,credentialScript(),require('./data-path.cjs').ownerCandidates(base,app.getPath('desktop')));", name)
        text = text.replace("filters:[{name:'Java executable',extensions:['exe']}]", "filters:[{name:'Java executable',extensions:['*']}]")
        text = text.replace("Windows credential encryption is unavailable.", "A secure credential store is unavailable. Unlock the login keyring first.")
        text = replace_once(text, 'javaRelative:settings.java?null:',
            "javaRelative:(settings.java||process.platform==='linux')?null:", name)
        text = replace_once(text, 'const java=settings.java||(instance.javaRelative?await core.contained(directory,instance.javaRelative):instance.java);',
            "const java=settings.java||(process.platform==='linux'&&instance.javaMajor&&process.env['BORALANCES_JAVA_'+instance.javaMajor])||(instance.javaRelative?await core.contained(directory,instance.javaRelative):instance.java);", name)
        text = replace_once(text, "child=spawn(command[0],command.slice(1),{cwd:directory,windowsHide:true,stdio:['ignore','pipe','pipe']});",
            "if(process.platform==='linux'&&process.env.BORALANCES_GAMEMODERUN)command=[process.env.BORALANCES_GAMEMODERUN,...command];\n  child=spawn(command[0],command.slice(1),{cwd:directory,windowsHide:true,stdio:['ignore','pipe','pipe']});", name)
    if name == 'src/data-path.cjs':
        text = replace_once(text, 'return packaged&&!portable?', "return process.platform==='linux'?path.join(appData,'BoralancesLauncher','data'):packaged&&!portable?", name)
    if name == 'src/provider-defaults.cjs':
        # Local distribution credentials are intentionally NOT copied.
        text = "'use strict';\nmodule.exports={curseforgeKey:process.env.CURSEFORGE_API_KEY||''};\n"
    if name == 'backend/worker.py':
        text = replace_once(text, "    component = metadata.get('javaVersion', {}).get('component', 'jre-legacy')",
            "    if sys.platform == 'linux':\n"
            "        major = metadata.get('javaVersion', {}).get('majorVersion', 8)\n"
            "        native = os.environ.get('BORALANCES_JAVA_' + str(major))\n"
            "        if native and Path(native).is_file():\n"
            "            return native\n"
            "    component = metadata.get('javaVersion', {}).get('component', 'jre-legacy')", name)
        text = replace_once(text, "return {'installedVersion': version, 'java': java}",
            "return {'installedVersion': version, 'java': java, 'javaMajor': next((int(key.rsplit('_', 1)[1]) for key, value in os.environ.items() if key.startswith('BORALANCES_JAVA_') and value == java), None)}", name)
    return text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--animations', type=Path, default=Path(r'C:\Users\Bora\Desktop\BoralancesAnimations'))
    parser.add_argument('--launcher', type=Path, default=Path(r'C:\Users\Bora\Desktop\BoralancesLauncher'))
    args = parser.parse_args()
    records = []

    def copy_file(src, dest, transform=None):
        if src.is_symlink():
            raise ValueError(f'Symlinks are not imported: {src.name}')
        raw = src.read_bytes()
        data = raw
        if transform:
            data = transform(raw.decode('utf-8-sig').replace('\r\n', '\n')).encode('utf-8')
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        records.append({'path': dest.relative_to(ROOT).as_posix(),
                        'sourceSha256': hashlib.sha256(raw).hexdigest(),
                        'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})

    destination = ROOT / 'vendor/boralances-launcher'
    for part in ('src', 'backend', 'assets'):
        for src in sorted((args.launcher / part).rglob('*')):
            if not src.is_file():
                continue
            rel = src.relative_to(args.launcher)
            if set(rel.parts) & DENIED_PARTS or src.suffix.lower() not in ALLOWED:
                continue
            transform = (lambda value, rel=rel: patch_launcher(rel, value)) if src.suffix in TEXT else None
            copy_file(src, destination / rel, transform)
    for name in ('LICENSE', 'README.md', 'requirements.txt'):
        copy_file(args.launcher / name, destination / name)
    # Only the one pure-JS production dependency. No installed Electron binaries.
    dependency = args.launcher / 'node_modules/adm-zip'
    for src in sorted(dependency.rglob('*')):
        if src.is_file() and not src.is_symlink() and (src.suffix in TEXT or src.name == 'LICENSE'):
            copy_file(src, destination / 'node_modules/adm-zip' / src.relative_to(dependency))
    package = json.loads((args.launcher / 'package.json').read_text(encoding='utf-8-sig'))
    distilled = {k: package[k] for k in ('name', 'version', 'description', 'main', 'author', 'license')}
    distilled['dependencies'] = {'adm-zip': '0.5.16'}
    distilled['boralancesOS'] = {'platform': 'linux', 'updates': 'system', 'sourceVersion': package['version']}
    (destination / 'package.json').write_text(json.dumps(distilled, indent=2) + '\n', encoding='utf-8')
    for name in ('reference-optics.js', 'google-glass.css', 'google-glass.js'):
        copy_file(args.animations / 'Browser/web' / name, ROOT / 'apps/browser/boralances_browser/web' / name)
    # Companion is optional to install on Android; no desktop signing key is copied.
    companion = args.animations / 'Jarvis/BoralancesJarvis-android16.apk'
    if companion.is_file():
        copy_file(companion, ROOT / 'integrations/android' / companion.name)
    manifest = {'schema': 1, 'sourceProjects': ['BoralancesAnimations/Browser', 'BoralancesAnimations/Jarvis',
        'BoralancesAnimations/HDMI Glass', 'BoralancesAnimations/Suite', 'BoralancesLauncher'],
        'policy': 'Allowlisted source/assets only; profiles, credentials, caches and Windows binaries excluded.',
        'files': records}
    (ROOT / 'integrations/import-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {len(records)} distributable files; Linux patches applied; user data excluded.')


if __name__ == '__main__':
    main()
