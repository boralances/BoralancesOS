"""Export only release source, leaving caches and user build outputs behind."""
import hashlib
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ALLOW = {'.github', 'apps', 'assets', 'config', 'design', 'docs', 'hosts', 'integrations', 'modules', 'packages', 'scripts', 'tests', 'vendor'}
ROOT_FILES = {'flake.nix', 'flake.lock', 'installer-preferences.nix', 'README.md', 'THIRD-PARTY.md', 'LICENSE', 'CONTRIBUTING.md', '.gitattributes', '.gitignore'}
destination = ROOT / 'out/V1/BoralancesOS-V1-source.zip'
destination.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(ROOT.rglob('*')):
        rel = path.relative_to(ROOT)
        if not path.is_file() or not (rel.parts[0] in ALLOW or str(rel) in ROOT_FILES):
            continue
        if set(rel.parts) & {'__pycache__', '.cache', 'test-output', 'node_modules', '.venv'}:
            continue
        if path.name in {'hardware-configuration.local.nix','drivers.local.nix','account.json','.env'} or (path.name.startswith('.env.') and path.name!='.env.example'):
            continue
        archive.write(path, Path('BoralancesOS') / rel)
digest = hashlib.sha256(destination.read_bytes()).hexdigest()
destination.with_suffix('.zip.sha256').write_text(digest + '  ' + destination.name + '\n')
print(f'{destination.name}: {destination.stat().st_size:,} bytes; SHA256 {digest}')
