"""Cross-platform static checks; never claim to replace a Linux image boot."""
import ast
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[1]
errors = []


def record(error):
    errors.append(error)
    print('FAIL:', error)


for base in ('apps', 'scripts', 'tests', 'vendor/boralances-launcher/backend'):
    for file in (ROOT / base).rglob('*.py'):
        try:
            ast.parse(file.read_text(encoding='utf-8-sig'), filename=str(file))
        except SyntaxError as error:
            record(str(error))
for file in [ROOT / 'config/alacritty.toml', ROOT / 'apps/browser/pyproject.toml']:
    try:
        tomllib.loads(file.read_text())
    except ValueError as error:
        record(str(error))
for file in [ROOT / 'config/waybar/config.jsonc', *list((ROOT / 'integrations').glob('*.json'))]:
    try:
        json.loads(file.read_text(encoding='utf-8'))
    except ValueError as error:
        record(f'{file.name}: {error}')

node = shutil.which('node')
if node:
    files = list((ROOT / 'vendor/boralances-launcher/src').rglob('*.cjs'))
    files += list((ROOT / 'apps/browser/boralances_browser/web').glob('*.js'))
    files += list((ROOT / 'design').glob('*.js')) + list((ROOT / 'scripts').glob('*.cjs'))
    for file in files:
        result = subprocess.run([node, '--check', str(file)], capture_output=True, text=True)
        if result.returncode:
            record(result.stderr)
    print(f'JavaScript syntax: {len(files)} files checked')
else:
    print('SKIP JavaScript syntax: node is unavailable')

qa = ROOT / '.cache/qa'
if qa.exists():
    sys.path.insert(0, str(qa))
try:
    from tree_sitter import Language, Parser
    import tree_sitter_nix
    parser = Parser(Language(tree_sitter_nix.language()))
    files = [ROOT / 'flake.nix', ROOT / 'installer-preferences.nix', *list((ROOT / 'modules').glob('*.nix')),
             *list((ROOT / 'hosts').glob('*.nix')), *list((ROOT / 'packages').glob('*.nix'))]
    for file in files:
        tree = parser.parse(file.read_bytes())
        if tree.root_node.has_error:
            record(f'Nix syntax: {file.relative_to(ROOT)}')
    print(f'Nix syntax: {len(files)} files parsed; semantic evaluation still requires Nix')
except ImportError:
    print('SKIP optional Nix syntax parser; run nix flake check on Linux')

suite = unittest.defaultTestLoader.discover(str(ROOT / 'tests'))
result = unittest.TextTestRunner(verbosity=2).run(suite)
if not result.wasSuccessful():
    errors.append('Unit/integration checks failed')
if errors:
    raise SystemExit(1)
print('Static validation passed. Linux build, hardware boot and performance measurements are separate release gates.')
