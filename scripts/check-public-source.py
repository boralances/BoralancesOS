"""Keep source uploads small and generated/private machine files out of Git."""
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
result=subprocess.run(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT,capture_output=True,check=True)
failures=[];count=0
for raw in result.stdout.split(b'\0'):
    if not raw:continue
    name=raw.decode('utf-8',errors='surrogateescape');relative=Path(name);path=ROOT/relative
    if path.is_symlink() or not path.is_file():continue
    count+=1
    private=relative.name in {'hardware-configuration.local.nix','drivers.local.nix','account.json','.env'}
    private=private or (relative.name.startswith('.env.') and relative.name!='.env.example')
    generated=relative.parts[0] in {'out','.cache','test-output','node_modules'}
    if private or generated:failures.append(name+': generated or private machine file')
    if path.stat().st_size>=25_000_000:failures.append(name+': exceeds the 25 MB source-upload limit')
if failures:raise SystemExit('\n'.join(failures))
print(f'Public source check passed: {count} files; no generated/private machine files or files >=25 MB.')
