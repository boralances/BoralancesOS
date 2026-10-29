"""Copy release sources into the Linux build filesystem without host caches."""
import os
from pathlib import Path
import shutil
import sys

source = Path(__file__).resolve().parents[1]
destination = Path(sys.argv[1]).resolve()
if destination == source.resolve() or str(destination) in ('/', '/root', '/home'):
    raise SystemExit('Choose a dedicated build source directory.')
directories = {'.github', 'apps', 'assets', 'config', 'design', 'docs', 'hosts', 'integrations', 'modules', 'packages', 'scripts', 'tests', 'vendor'}
files = {'.gitattributes', '.gitignore', 'flake.nix', 'flake.lock', 'installer-preferences.nix', 'README.md', 'THIRD-PARTY.md'}
count = 0
for root, dirs, names in os.walk(source):
    rel = Path(root).relative_to(source)
    if rel == Path('.'):
        dirs[:] = [name for name in dirs if name in directories]
    else:
        dirs[:] = [name for name in dirs if name not in {'__pycache__', '.cache', 'test-output'}]
    for name in names:
        if rel == Path('.') and name not in files:
            continue
        src = Path(root) / name
        dst = destination / rel / name
        data = src.read_bytes()
        if src.suffix in {'.py', '.sh', '.nix', '.conf', '.rasi', '.css', '.toml', '.ini', '.lua', '.script'}:
            data = data.replace(b'\r\n', b'\n')
        if not dst.exists() or dst.read_bytes() != data:
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(data)
            count += 1
print(f'Updated {count} release files in {destination}')
